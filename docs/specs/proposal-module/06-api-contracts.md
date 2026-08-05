# 06 — Contratos de API do Serviço de Propostas

> **Arquitetura proposta** (não implementada). API REST do Serviço de Propostas (NestJS — `04-technical-spec.md`).
> Convenções: JSON; erros no formato `{ "error": { "code", "message", "details" } }`; datas ISO-8601 UTC; valores monetários em `amountMicros` + `currencyCode` (paridade com o composite CURRENCY do Twenty).

## 1. Autenticação e autorização (resumo — detalhes em `09-approval-and-security.md`)

| Esquema | Uso | Autorização |
|---|---|---|
| `Authorization: Bearer <JWT de serviço>` com claim `actor` (usuário Twenty) | Chamadas vindas das logic functions do App óDois | Papel do `actor` × matriz do doc 09; transição × máquina de estados |
| `Authorization: Bearer <token interno>` | Jobs/worker (S2S) | Apenas rotas internas; jamais `approve` |
| Token no path + HMAC/headers | Webhooks Evolution | Instância allowlisted; dedupe |
| Token de host MCP (F4) | Ferramentas `proposal.*` | Classificação do doc 12; sensíveis exigem identidade humana |

**Idempotência**: todo `POST` de ação aceita header `Idempotency-Key`; repetição com a mesma chave retorna a resposta original (tabela `idempotency_key`, `05-data-model.md`). Webhooks usam chave natural `(instanceId, messageId)`.

## 2. Endpoints

Formato por endpoint: objetivo · auth · payload → resposta · validações/idempotência · erros · eventos.

### 2.1 `POST /webhooks/evolution/messages`
- **Objetivo**: ingerir eventos de mensagem da Evolution API (`messages.upsert`).
- **Auth**: token secreto por instância no path/header + HMAC quando disponível (`11-evolution-api-integration.md`).
- **Payload**: payload nativo da Evolution (fixado por versão na implementação).
- **Resposta**: `202 { "received": true }` — sempre rápida; processamento assíncrono.
- **Validações**: assinatura; instância ativa; replay window; dedupe `(instanceId, messageId)` (duplicata ⇒ `202` no-op); rate limit por telefone.
- **Erros**: `401 INVALID_WEBHOOK_SIGNATURE`, `404 UNKNOWN_INSTANCE`, `429 RATE_LIMITED`.
- **Eventos**: `proposal.request.received` (nova conversa) ou anexação à sessão (`proposal.messages.collected` ao fechar janela).

### 2.2 `POST /webhooks/evolution/status`
- **Objetivo**: ingerir atualizações de status de mensagens enviadas (entregue/lido/falha).
- **Auth/validações**: idem 2.1.
- **Resposta**: `202`.
- **Efeitos**: correlaciona `evolutionMessageId` com proposta enviada; `SENT → VIEWED`; falha assíncrona de entrega ⇒ avaliação de `SEND_ERROR`.
- **Eventos**: `proposal.viewed`, `proposal.send.failed`.

### 2.3 `POST /proposals`
- **Objetivo**: criar proposta manualmente (origem `MANUAL` ou `MCP`).
- **Auth**: JWT de serviço (actor com papel atendente/responsável/admin) ou MCP (baixo risco).
- **Payload**: `{ title, companyId?, contactId?, opportunityId?, ownerId?, items?[], commercialTerms?, recipientPhone? }`.
- **Resposta**: `201 { proposal }` — estado inicial `DRAFT_GENERATED` (cria versão 1) ou `NEEDS_INFORMATION` se incompleta.
- **Validações**: referências existentes no Twenty; moeda única; catálogo ativo para itens referenciados.
- **Erros**: `400 VALIDATION_ERROR`, `403 FORBIDDEN_ROLE`, `422 UNRESOLVED_REFERENCE`.
- **Eventos**: `proposal.draft.created`, `proposal.version.created`.

### 2.4 `GET /proposals/{proposalId}`
- **Objetivo**: detalhe completo: dados, itens, status, versões (resumo), aprovação vigente, URLs assinadas (prévia; final somente se `status ∈ {READY_TO_SEND, SENDING, SENT, VIEWED, ACCEPTED}`).
- **Auth**: qualquer papel interno com leitura; MCP leitura.
- **Erros**: `404 NOT_FOUND`, `403`.
- **Eventos**: nenhum (leituras não geram evento; download de documento gera log de acesso).

### 2.5 `PATCH /proposals/{proposalId}`
- **Objetivo**: edição manual de campos/itens.
- **Auth**: responsável/admin (atendente: campos não comerciais).
- **Payload**: patch parcial `{ title?, scope?, items?[...], commercialTerms?, validUntil?, recipientPhone?, ... }`.
- **Resposta**: `200 { proposal, approvalInvalidated: boolean }`.
- **Validações**: status editável (`DRAFT_GENERATED`, `AWAITING_INTERNAL_REVIEW`, `CHANGES_REQUESTED`, `NEEDS_INFORMATION`; em `APPROVED`/`READY_TO_SEND` a edição é aceita **com invalidação automática** — `09` §1.5); preços ≥ mínimos do catálogo salvo flag de exceção do responsável; totais recalculados pelo serviço.
- **Efeitos**: nova versão **não** é criada a cada PATCH — apenas ao "salvar como versão" (`proposal.version.created`) ou ao gerar prévia; edição em estado aprovado ⇒ `CHANGES_REQUESTED` + `proposal.approval.invalidated`.
- **Erros**: `409 INVALID_STATE_FOR_EDIT`, `422 PRICE_BELOW_MINIMUM`.

### 2.6 `POST /proposals/{proposalId}/interpret`
- **Objetivo**: (re)interpretar mensagens acumuladas ou instrução de ajuste em linguagem natural.
- **Auth**: JWT de serviço (humano) ou interno (fluxo automático).
- **Payload**: `{ instruction?: string }` (ausente ⇒ reinterpretar fontes).
- **Resposta**: `202 { jobId }` — assíncrono.
- **Validações**: transição permitida para `INTERPRETING` a partir do estado atual (07 §4).
- **Erros**: `409 INVALID_STATE_TRANSITION`.
- **Eventos**: `proposal.interpretation.completed` (ou `proposal.information.requested` / `PROPOSAL_PROCESSING_FAILED`) ao concluir o job.

### 2.7 `POST /proposals/{proposalId}/generate-preview`
- **Objetivo**: gerar/regenerar prévia (sempre com marca d'água) da versão corrente; cria nova versão se houver mudanças não versionadas.
- **Auth**: atendente/responsável/revisor/admin; interno (automático pós-rascunho).
- **Resposta**: `202 { jobId }`.
- **Erros**: `409 INVALID_STATE_TRANSITION` (ex.: em `SENDING`).
- **Eventos**: `proposal.version.created` (se aplicável), `proposal.preview.generated`, `proposal.review.requested`.

### 2.8 `POST /proposals/{proposalId}/request-changes`
- **Objetivo**: registrar pedido de ajustes (revisor/aprovador/atendente registrando pedido do solicitante).
- **Auth**: papéis com "solicitar ajustes" (09 §2.2).
- **Payload**: `{ comment: string, instruction?: string, source: "INTERNAL" | "REQUESTER" }`.
- **Resposta**: `200 { proposal }` — status `CHANGES_REQUESTED`; se `instruction` presente, encadeia interpretação (2.6).
- **Erros**: `409`, `403`.
- **Eventos**: `proposal.changes.requested` (+ `proposal.approval.invalidated` se estava aprovada).

### 2.9 `POST /proposals/{proposalId}/request-approval`
- **Objetivo**: solicitar aprovação formal da versão corrente.
- **Auth**: responsável/revisor/admin (humano).
- **Payload**: `{ versionId, approverId?, message? }`.
- **Resposta**: `201 { approval }` — status `PENDING_APPROVAL`.
- **Validações**: `versionId == currentVersionId`; prévia existente para a versão; sem aprovação pendente duplicada.
- **Erros**: `409 APPROVAL_VERSION_MISMATCH`, `409 APPROVAL_ALREADY_PENDING`.
- **Eventos**: `proposal.approval.requested`.

### 2.10 `POST /proposals/{proposalId}/approve`
- **Objetivo**: **aprovação humana explícita** de uma versão exata.
- **Auth**: **somente** JWT de serviço com `actor` humano de papel aprovador. Credencial de agente/integração/MCP-agente ⇒ `403` incondicional.
- **Payload**: `{ versionId, snapshotHash, comment? }` — o cliente deve ecoar o hash exibido (prova de que aprovou o que viu).
- **Resposta**: `200 { proposal, approval }` — status `APPROVED`; geração do documento final enfileirada.
- **Validações**: aprovação `PENDING` existente para `versionId`; `versionId == currentVersionId`; `snapshotHash` == hash recomputado do snapshot; papel aprovador; política de auto-aprovação (09 §2.2).
- **Erros**: `403 APPROVER_ROLE_REQUIRED`, `403 NON_HUMAN_ACTOR`, `409 APPROVAL_VERSION_MISMATCH`, `409 SNAPSHOT_HASH_MISMATCH`.
- **Eventos**: `proposal.approved` → (job) `proposal.final_document.generated`.

### 2.11 `POST /proposals/{proposalId}/reject`
- **Objetivo**: rejeição interna (revisor/aprovador/responsável) com motivo.
- **Payload**: `{ reason, comment? }` → `200`, status `REJECTED` (terminal).
- **Erros**: `409` fora dos estados de revisão/aprovação.
- **Eventos**: `proposal.rejected`.

### 2.12 `POST /proposals/{proposalId}/generate-final`
- **Objetivo**: (re)gerar documento final a partir do snapshot aprovado (uso normal é automático pós-aprovação; endpoint existe para retry humano após `PROCESSING_ERROR`).
- **Auth**: responsável/admin; interno.
- **Resposta**: `202 { jobId }`.
- **Validações**: `status ∈ {APPROVED, PROCESSING_ERROR(failedStep=final)}`; `approvedSnapshotHash` presente; hash recomputado do snapshot aprovado confere (senão ⇒ invalidação).
- **Erros**: `409 NOT_APPROVED`, `409 SNAPSHOT_HASH_MISMATCH`.
- **Eventos**: `proposal.final_document.generated`.

### 2.13 `POST /proposals/{proposalId}/send`
- **Objetivo**: **autorização humana de envio** do documento final ao solicitante.
- **Auth**: humano com papel de envio (responsável/admin). Agentes/MCP autônomos ⇒ `403`.
- **Payload**: `{ recipientPhone, finalDocumentHash, confirmationText?: "ENVIAR" }` — eco do destinatário e do hash exibidos na confirmação.
- **Resposta**: `202 { jobId }` — status `SENDING`.
- **Validações**: **gate completo `canSendProposal`** (09 §1.2) reavaliado aqui **e** no job; `recipientPhone` == validado; `finalDocumentHash` ecoado confere; lock de proposta livre.
- **Erros**: `409 SEND_PRECONDITION_FAILED` (com lista das condições reprovadas), `409 SEND_IN_PROGRESS`, `403`.
- **Eventos**: `proposal.send.requested` → (job) `proposal.sent` ou `proposal.send.failed`.

### 2.14 `POST /proposals/{proposalId}/retry-send`
- **Objetivo**: reenvio humano após `SEND_ERROR` — **mesma versão, mesmo artefato, mesmo hash**; nova `Idempotency-Key` por tentativa.
- **Auth/validações/erros**: idem 2.13; adicionalmente `status == SEND_ERROR` e verificação de que não houve `messageId` registrado na tentativa anterior (proteção contra envio duplicado quando a falha foi só no ack — `11-evolution-api-integration.md`).
- **Eventos**: `proposal.send.requested`, depois `proposal.sent`/`proposal.send.failed`.

### 2.15 `GET /proposals/{proposalId}/versions`
- **Objetivo**: listar versões (número, criadoPor, motivo, hash, artefatos) e obter diff `?compare=v3..v5` (estrutural, por campo/item).
- **Auth**: leitura interna; MCP leitura.
- **Erros**: `404`.

### 2.16 `GET /proposals/{proposalId}/events`
- **Objetivo**: trilha de auditoria paginada (`?after=cursor&type=...`), com ator, origem, payload, correlation/causation.
- **Auth**: leitura interna (papéis com "consultar histórico"); MCP leitura.
- **Erros**: `404`.

### 2.17 Endpoints auxiliares (não exigidos no enunciado, necessários à operação)
- `GET /proposals?status=&ownerId=&q=` — busca/lista (paginada) para MCP `proposal.search` e telas.
- `POST /proposals/{id}/cancel` — cancelamento (papéis do doc 09).
- `POST /proposals/{id}/record-outcome` — registrar aceite/recusa/pedido de alteração do solicitante (`{ outcome: ACCEPTED|REJECTED|CHANGES_REQUESTED, evidenceMessageId? }`), sempre por humano; eventos `proposal.accepted`/`proposal.rejected`/`proposal.changes.requested`.
- `GET /health` — liveness/readiness (padrão `/healthz` do Twenty).

## 3. Eventos internos (catálogo canônico)

Persistidos em `proposal_event` e publicados no barramento interno (BullMQ) para efeitos derivados (espelho no Twenty, notificações, timeline). Envelope:

```json
{
  "id": "evt_...", "type": "proposal.approved", "occurredAt": "...",
  "proposalId": "...", "versionId": "...",
  "actor": "user:uuid | system | integration:twenty | agent:mcp:host",
  "origin": "UI | WEBHOOK | WORKER | MCP | SYSTEM",
  "correlationId": "...", "causationId": "...",
  "payload": { }
}
```

| Evento | Emitido quando | Payload típico |
|---|---|---|
| `proposal.request.received` | webhook validado cria proposta-embrião | instanceId, messageId, phone |
| `proposal.messages.collected` | janela de agrupamento fechada | messageIds[], windowMs |
| `proposal.interpretation.completed` | LLM + validação concluídas | promptVersion, confidence, missingFields |
| `proposal.information.requested` | perguntas complementares definidas/enviadas | questions[], channel |
| `proposal.draft.created` | rascunho estruturado persistido/espelhado | versionNumber |
| `proposal.preview.generated` | artefato PREVIEW pronto | artifactId, sha256 |
| `proposal.review.requested` | entrada em `AWAITING_INTERNAL_REVIEW` + notificação | notifiedUserIds |
| `proposal.changes.requested` | pedido de ajustes registrado | source, comment |
| `proposal.version.created` | nova versão snapshotada | versionNumber, snapshotHash, diff |
| `proposal.approval.requested` | solicitação formal criada | versionId, approverId |
| `proposal.approved` | decisão humana registrada | approvalId, snapshotHash, ip |
| `proposal.approval.invalidated` | alteração pós-aprovação / hash divergente | previousApprovalId, changedFields |
| `proposal.final_document.generated` | artefato FINAL + hash gravados | artifactId, sha256 |
| `proposal.send.requested` | autorização humana de envio aceita pelo gate | recipientPhone, finalDocumentHash |
| `proposal.sent` | ack da Evolution com messageId | evolutionMessageId, instanceId |
| `proposal.send.failed` | falha após retries do job | errorCode, attempt |
| `proposal.viewed` | status de leitura correlacionado | evolutionMessageId |
| `proposal.accepted` | desfecho registrado por humano | evidenceMessageId? |
| `proposal.rejected` | rejeição interna ou do solicitante | reason, source |
| (técnicos) `PROPOSAL_CANCELED`, `PROPOSAL_EXPIRED`, `PROPOSAL_PROCESSING_FAILED`, `MIRROR_RECONCILED` | ver docs 05/07 | — |

## 4. Regras transversais de erro

- `401` autenticação ausente/ inválida · `403` papel/ator não autorizado (inclui `NON_HUMAN_ACTOR` para approve/send) · `404` recurso inexistente ou fora do workspace · `409` conflito de estado/versão/hash/lock (sempre com `code` específico) · `422` validação semântica (preço mínimo, referência inexistente) · `429` rate limit.
- Toda resposta `409`/`403` de ação sensível gera `proposal_event` (tentativas bloqueadas são auditadas).
- Erros de webhook nunca vazam detalhes internos (resposta genérica; detalhe só em log).
