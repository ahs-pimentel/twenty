# 11 — Integração com Evolution API (WhatsApp)

> Módulo proprietário óDois — arquitetura **proposta** (não implementada).
> Segurança de webhook consistente com `09-approval-and-security.md` §4; estados e eventos conforme `07-state-machine.md`.

## 1. Estado atual do repositório (o que existe hoje)

**Não existe nenhuma integração WhatsApp/Evolution/Twilio/SMS no Twenty.** Evidências:

| Evidência | Caminho real |
|---|---|
| Único vestígio "WhatsApp": campo LINKS `whatsapp` em seeds de `Person` | seeds de dados de exemplo do standard object Person |
| `MessageChannelType.SMS` declarado, porém **sem uso** (nenhum driver/canal implementado) | `packages/twenty-shared/src/types/MessageChannelType.ts` |
| Canais de mensageria existentes limitados a e-mail/calendário (Gmail/Microsoft/IMAP) | `packages/twenty-server/src/modules/messaging-*`, `.../connected-account-sync-webhooks/` |

**Conclusão:** a integração com a Evolution API é **100% nova e proprietária**, implementada **exclusivamente no Serviço de Propostas** (`proposal-service`). O core do Twenty não é tocado (decisão 1 de `02-architecture-decisions.md`); o Twenty só enxerga o resultado via objetos do App óDois, atualizados pelo serviço através do `twenty-client-sdk` + API key.

Padrões do repositório **reutilizados como referência** (não como código compartilhado): HMAC de webhook (`packages/twenty-server/src/engine/metadata-modules/webhook/jobs/call-webhook.job.ts`), filas BullMQ com `jobId` determinístico (`packages/twenty-server/src/engine/core-modules/message-queue/services/message-queue.service.ts`), storage com URL assinada (`packages/twenty-server/src/engine/core-modules/file-storage/`), lock distribuído (`packages/twenty-server/src/engine/core-modules/cache-lock/`), SSRF guard para chamadas HTTP de saída (`packages/twenty-server/src/engine/core-modules/secure-http-client/secure-http-client.service.ts`).

## 2. Visão da Evolution API

A Evolution API é um **gateway WhatsApp self-hosted** (externo ao repo) que expõe:

- **Instância**: uma conexão WhatsApp (um número) identificada por nome, autenticada por `apikey`. Uma instalação pode hospedar várias instâncias.
- **Webhooks de eventos** por instância, incluindo:
  - `messages.upsert` — mensagem recebida (texto, áudio, imagem, documento...);
  - `messages.update` — atualização de status de mensagem enviada (`DELIVERY_ACK`/entregue, `READ`/lida);
  - eventos de conexão da instância (`connection.update`).
- **Envio via REST**, por instância: `sendText` (texto), `sendMedia` (documento/imagem com legenda), entre outros.

> **Questão aberta (registrar antes da implementação):** o contrato exato (nomes de eventos, formato do payload, headers de autenticação do webhook, rotas de envio) **varia por versão da Evolution API**. A versão será **fixada (pin)** na implementação, com testes de contrato contra essa versão e revisão a cada upgrade.

## 3. Responsabilidades da integração

| # | Responsabilidade | Direção |
|---|---|---|
| 1 | Receber mensagens do solicitante (texto, áudio, anexos) | Evolution → Serviço (webhook) |
| 2 | Enviar confirmações de recebimento ("recebemos sua solicitação...") | Serviço → Evolution |
| 3 | Coletar informações complementares (perguntas de `NEEDS_INFORMATION`) | Serviço → Evolution |
| 4 | Enviar a proposta **aprovada** (PDF final) — somente após gate de envio | Serviço → Evolution |
| 5 | Registrar identificadores das mensagens (`messageId` da Evolution) para dedupe, correlação e tracking de status | Ambas |

## 4. Configuração — entidade `evolution_instance`

Tabela no Postgres do Serviço de Propostas (ver `05-data-model.md`); suporta **múltiplas instâncias** (ex.: um número por unidade de negócio):

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Nome da instância na Evolution API |
| `baseUrl` | text | URL base da instalação Evolution (validada contra SSRF no egress) |
| `apiKeyEncrypted` | text | `apikey` da instância, cifrada com chave de aplicação (padrão `APP_SECRET` do Twenty como referência — `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`) |
| `webhookSecret` | text | Segredo por instância para validar webhooks de entrada |
| `phoneNumber` | text | Número E.164 da instância |
| `status` | enum | `CONNECTED` \| `DISCONNECTED` \| `DISABLED` (alimentado por `connection.update` + healthcheck) |
| `createdAt` / `updatedAt` | timestamptz | — |

### 4.1 Segurança do webhook (resumo — detalhe em `09-approval-and-security.md` §4)

1. **Token no path** (`POST /webhooks/evolution/messages/{instanceToken}`) **+ header** de segredo; **HMAC** do payload quando a versão da Evolution suportar assinatura.
2. **Allowlist** de origem (IP/host da instalação Evolution) + TLS obrigatório.
3. **Replay window** de ±5 min quando houver timestamp assinado.
4. **Dedupe persistente** por unique `(instanceId, messageId)` em `proposal_source_message` — replay/redelivery vira no-op idempotente auditado.
5. O handler do webhook **não chama LLM nem Evolution**: valida, persiste, enfileira (job com `jobId` determinístico) e responde 2xx rápido.

## 5. Mapeamento de eventos

| Evento Evolution | Condição | Ação no Serviço de Propostas |
|---|---|---|
| `messages.upsert` (texto) | `fromMe=false` | Pipeline de ingestão: dedupe → `proposal_source_message` → resolução telefone→`person` → criação/anexação à proposta → estados `REQUEST_RECEIVED`/`COLLECTING_MESSAGES` |
| `messages.upsert` (áudio/imagem/documento) | `fromMe=false` | Idem + job de download de mídia (§8); transcrição/extração na F3 |
| `messages.upsert` | `fromMe=true` (mensagem enviada pelo próprio número, ex.: atendimento manual pelo celular) | **Ignorada para o pipeline** de propostas; opcionalmente registrada em `wa_session` para contexto da conversa — nunca cria proposta |
| `messages.update` — status entregue | `messageId` corresponde a envio de proposta registrado | Registro em `proposal_event`; sem mudança de estado |
| `messages.update` — status lido | `messageId` corresponde a envio de proposta registrado | Transição `SENT → VIEWED` (`viewedAt`), evento `proposal.viewed` |
| `messages.update` | `messageId` desconhecido | Registrado e descartado (no-op auditado) |
| `connection.update` | — | Atualiza `evolution_instance.status`; `DISCONNECTED` dispara alerta ao administrador |

## 6. Sequência — recebimento de mensagem

```mermaid
sequenceDiagram
    autonumber
    participant C as Solicitante (WhatsApp)
    participant E as Evolution API (instância)
    participant W as Serviço de Propostas (webhook)
    participant DB as Postgres do Serviço
    participant Q as Fila (BullMQ)
    participant K as Worker de Propostas
    participant L as LLM (Vercel AI SDK)
    participant T as Twenty (API + App óDois)
    C->>E: mensagem WhatsApp
    E->>W: POST /webhooks/evolution/messages/{instanceToken} (messages.upsert)
    W->>W: valida token/header/HMAC + allowlist + replay window
    W->>DB: upsert proposal_source_message (unique instanceId+messageId)
    alt mensagem duplicada
        W-->>E: 200 (no-op idempotente auditado)
    else mensagem nova
        W->>DB: cria/atualiza proposta (REQUEST_RECEIVED / COLLECTING_MESSAGES)
        W->>Q: enfileira job (jobId determinístico)
        W-->>E: 200 (rápido; nada de LLM no request)
        Q->>K: job de interpretação (janela de agrupamento fechada)
        K->>K: status → INTERPRETING
        K->>L: generateObject (schema 08-llm-spec.md §4)
        L-->>K: JSON validado (zod + JSON Schema)
        K->>DB: proposal_event proposal.interpretation.completed + versão
        K->>T: cria/atualiza proposal + proposalItem (twenty-client-sdk + API key)
        K->>K: status → DRAFT_GENERATED (ou NEEDS_INFORMATION / PROCESSING_ERROR)
    end
```

## 7. Sequência — envio da proposta aprovada

```mermaid
sequenceDiagram
    autonumber
    participant H as Humano (responsável/admin — Twenty UI)
    participant T as Twenty (App óDois)
    participant S as Serviço de Propostas (API)
    participant Q as Fila (BullMQ)
    participant K as Worker de Propostas
    participant ST as Storage (S3/MinIO)
    participant E as Evolution API
    participant C as Solicitante (WhatsApp)
    H->>T: clica "Enviar" (READY_TO_SEND; confirma destinatário + documento)
    T->>S: POST /proposals/{id}/send (Idempotency-Key, actor propagado)
    S->>S: gate canSendProposal (09-approval-and-security.md §1.2)
    alt gate falha
        S-->>T: 409 SEND_PRECONDITION_FAILED
    else gate ok
        S->>S: status → SENDING · evento proposal.send.requested
        S->>Q: enfileira SendProposalJob (idempotency key por tentativa)
        Q->>K: executa job com lock distribuído por proposta
        K->>S: reavalia canSendProposal (proteção contra corrida)
        K->>ST: download do artefato kind=FINAL por finalDocumentId
        K->>K: sha256(pdf) == finalDocumentHash? (aborta se divergir)
        K->>E: POST sendMedia (PDF final + mensagem)
        E->>C: entrega no WhatsApp
        E-->>K: ack com messageId
        K->>S: registra evolutionInstanceId + evolutionMessageId + sentAt
        K->>S: status → SENT · evento proposal.sent
        S->>T: atualiza objeto proposal no Twenty
    end
    opt falha no envio (após retries limitados do job)
        K->>S: status → SEND_ERROR · evento proposal.send.failed
        S-->>H: notificação com diagnóstico
        H->>T: "Reenviar" ⇒ POST /proposals/{id}/retry-send
        Note over S,K: mesmo documento/hash · nova idempotency key · verifica messageId já registrado antes de chamar a Evolution
    end
```

## 8. Download de mídia recebida (áudio/anexos)

- Download feito pelo **worker** (nunca no request do webhook), autenticado com a `apikey` da instância, via endpoint de mídia da Evolution API (ou payload base64, conforme a versão fixada — §2).
- Armazenamento no storage do serviço (S3/MinIO), chave `proposals/{proposalId}/inbound/{messageId}/{filename}`; referência gravada em `proposal_source_message`.
- **Limites**: tamanho máximo configurável (sugestão: 25 MB); tipos permitidos por allowlist de MIME (`audio/ogg`, `audio/mpeg`, `image/jpeg`, `image/png`, `application/pdf`, DOCX/XLSX); tipo fora da lista ⇒ registrado + aviso ao atendente, sem processamento.
- Conteúdo tratado como hostil: nunca executado/renderizado sem sanitização; texto extraído entra na LLM sob envelope (`08-llm-spec.md` §7).
- Acesso interno via URL assinada de curta duração (padrão `09-approval-and-security.md` §5).

## 9. Tratamento de falhas

| Falha | Detecção | Tratamento |
|---|---|---|
| Instância desconectada | `connection.update` / erro no envio | Envio: job falha ⇒ retries limitados ⇒ `SEND_ERROR` + notificação; recepção: mensagens ficam na Evolution até reconexão; alerta ao administrador |
| Rate limit do WhatsApp / da Evolution | 429/erro específico | Backoff exponencial dentro dos retries do job; perguntas operacionais também respeitam fila com rate limit por instância |
| Número inválido / sem WhatsApp | Erro da Evolution no envio (ou verificação prévia de número quando a versão suportar) | `SEND_ERROR` com diagnóstico `INVALID_RECIPIENT`; correção exige editar destinatário ⇒ invalida aprovação (campo do snapshot) ⇒ novo ciclo |
| Timeout HTTP | Cliente HTTP com timeout (sugestão 30s) | Conta como tentativa falha; retries limitados do job |
| Webhook fora de ordem / duplicado | dedupe `(instanceId, messageId)` + upsert idempotente | No-op auditado |

**Garantia de não-duplicação de envio**: (a) lock distribuído por proposta durante `SENDING`; (b) idempotency key por tentativa `(proposalId, approvedVersionId, attempt)`; (c) antes de chamar a Evolution, o job verifica se já existe `evolutionMessageId` registrado para a tentativa — se o ack se perdeu mas o envio ocorreu, o retry **não** reenvia, apenas reconcilia o estado; (d) `SEND_ERROR → SENDING` só por humano (`retry-send`), nunca retry automático ilimitado (`07-state-machine.md` §3.21).

## 10. Mensagens operacionais × proposta (regra central)

| Tipo de mensagem | Quando | Pré-aprovação? | Conteúdo |
|---|---|---|---|
| Confirmação de recebimento | Após `REQUEST_RECEIVED` | ✔ permitida | Template operacional fixo, **sem valores comerciais** |
| Perguntas complementares | `NEEDS_INFORMATION` | ✔ permitida | Templates + perguntas de `missing_fields[].question_suggestion` (revisadas por template; sem valores comerciais) |
| Avisos de andamento ("estamos preparando sua proposta") | Opcional, configurável | ✔ permitida | Template operacional |
| **A proposta em si (PDF, valores, condições)** | Somente `READY_TO_SEND → SENDING` | **✖ jamais** | Exclusivamente o artefato `kind=FINAL`, após aprovação humana explícita e gate `canSendProposal` |

Reforço da regra central do módulo: *«Nenhuma proposta poderá ser disponibilizada ou enviada ao solicitante sem aprovação humana explícita da versão exata que será enviada.»* Mensagens operacionais não são a proposta e não contornam essa regra; o serviço de envio **recusa** qualquer tentativa de anexar artefato `kind=PREVIEW` ou de citar valores em templates operacionais (validação de template no admin).

## 11. Questões abertas

| # | Questão |
|---|---|
| 1 | Versão exata da Evolution API a fixar (nomes de eventos/rotas/headers variam) — testes de contrato obrigatórios na F1 |
| 2 | Suporte da versão escolhida a assinatura HMAC de webhook (se ausente: token + allowlist + TLS, conforme `09-approval-and-security.md` §4.1) |
| 3 | Verificação prévia de existência do número no WhatsApp (endpoint disponível em algumas versões) antes de `recipientValidatedAt` |
| 4 | Estratégia de janela de atendimento/limites de mensagens do WhatsApp para mensagens proativas (perguntas complementares após longo intervalo) |
