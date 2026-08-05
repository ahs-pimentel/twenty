# 17 — Contratos de API do o2d-ai-gateway

> **Arquitetura proposta** (não implementada). REST JSON, prefixo `/v1`. Erros: `{ "error": { "code", "message", "details", "correlationId" } }`. Datas ISO-8601 UTC; dinheiro em `amountMicros`+`currencyCode`. Schemas de payload versionados no `o2d-ai-contracts`.

## 1. Autenticação, headers e convenções

| Esquema | Chamador | Observação |
|---|---|---|
| `Authorization: Bearer <JWT de serviço>` com claim `actor` (usuário Twenty) | hub app via logic functions | ações correm **on-behalf-of** do actor |
| `Authorization: Bearer <token S2S>` | módulos proprietários (ex.: Serviço de Propostas), worker | escopos por módulo; jamais aprova |
| OAuth 2.1 / token MCP | `o2d-ai-mcp` | identidade do usuário vinculado (19-mcp-spec.md) |

Headers padrão: `X-O2d-Workspace-Id` (obrigatório; validado contra o token — divergência ⇒ `403 WORKSPACE_MISMATCH`), `Idempotency-Key` (obrigatório em POSTs de efeito), `X-Correlation-Id` (opcional; gerado se ausente e devolvido sempre). Rate limiting em todos os endpoints (429 + `Retry-After`). **Toda chamada autenticada gera auditoria** (no mínimo: quem, o quê, workspace, correlationId); as tabelas abaixo listam apenas eventos de domínio adicionais.

Formato por endpoint: objetivo · authz · payload → resposta · idempotência/timeout · erros específicos · eventos.

## 2. Descoberta e saúde

### `GET /v1/health`
Liveness/readiness + estado agregado de providers (sem detalhes sensíveis). Auth: nenhum p/ liveness; token p/ detalhe. Resposta: `{ status, providers: [{name, status}], queueDepth }`. Erros: —. Eventos: —.

### `GET /v1/providers`
Lista providers visíveis ao workspace (sem `secretRef`). Authz: `ai-admin` para detalhes; `ai-user` vê só nomes/status. Resposta: `{ providers: [...] }`. Admin CRUD de providers/modelos/rotas: endpoints `/v1/admin/*` (F2), sempre `ai-admin` + auditoria.

### `GET /v1/models`
Modelos ativos com capacidades e aliases (filtrados por workspace/tarefas permitidas). Authz: autenticado.

### `GET /v1/model-routes`
Rotas por tarefa vigentes para o workspace (principal, fallbacks, allowExternalFallback). Authz: `ai-admin` (conteúdo completo) / `ai-user` (resumo).

## 3. Inferência

### `POST /v1/chat`
- **Objetivo**: turno de conversa (streaming SSE por padrão; `stream:false` opcional).
- **Payload**: `{ conversationId?, agentId?, task?: "chat.general"|"chat.contextual", context?: { recordType, recordId }, message, attachments?: [fileRef] }`.
- **Resposta**: SSE `{delta|toolEvent|done{executionId, usage}}` ou JSON completo.
- **Authz**: `ai-user`; agente permitido p/ role/workspace.
- **Idempotência/timeout**: `Idempotency-Key`; timeout da rota do modelo.
- **Erros**: `MODEL_UNAVAILABLE`, `RATE_LIMITED`, `AGENT_NOT_ALLOWED`.
- **Eventos**: `ai.execution.requested/started/completed|failed`; `ai.tool.*` conforme uso.

### `POST /v1/generate`
Geração de texto por tarefa (`proposal.write`, `meeting.summarize`...): `{ task, input: {...}, promptRef?, options? }` → `{ executionId, output, usage }` (ou `202 {executionId}` com `async:true`). Erros: idem chat.

### `POST /v1/extract`
Extração estruturada: `{ task, input: {...}, response_schema: "proposal-extraction@1.0.0" }` → `{ executionId, data (validada), confidence, warnings }`. **Nunca** retorna dado não validado — `STRUCTURED_OUTPUT_INVALID` após retry de correção (12-structured-output.md). Eventos: `ai.structured_output.validated|invalid`.

### `POST /v1/embed`
`{ input: string|string[], task: "semantic.search" }` → `{ vectors, model, usage }`. Uso interno do RAG e de módulos autorizados. Erros: `MODEL_UNAVAILABLE`.

### `POST /v1/rerank`
`{ query, candidates: [...] }` → `{ ranked: [{index, score}] }`.

## 4. Agentes

### `POST /v1/agents/{agentId}/run`
Executa agente com laço LLM⇄tools sob o pipeline (05 §2): `{ input, context?, conversationId?, async? }` → `{ executionId, status, output?, pendingApprovals? }`. Authz: `ai-user` + agente permitido; tools limitadas à allowlist do agente ∩ permissões do usuário. Erros: `AGENT_NOT_ALLOWED`, `APPROVAL_REQUIRED` (status `WAITING_APPROVAL`). Eventos: `ai.execution.*`, `ai.tool.*`, `ai.approval.requested`.

### `GET /v1/agents/{agentId}`
Definição resolvida (sem prompt interno completo para não-admin). Authz: autenticado.

## 5. Ferramentas

### `GET /v1/tools`
Catálogo **filtrado** pelo contexto (usuário, workspace, agente opcional via `?agentId=`); tools `FORBIDDEN` nunca aparecem. Authz: autenticado.

### `POST /v1/tools/{toolName}/validate`
Valida args contra o input schema da versão vigente **sem executar**: `{ version?, args }` → `{ valid, errors?, riskLevel, requiresApproval }`. Uso: UI do hub e módulos. Sem eventos de execução.

### `POST /v1/tools/{toolName}/execute`
- **Objetivo**: executar tool pelo pipeline completo (validação → authz → risco → aprovação → executor). **Não** é atalho: mesmo pipeline da execução por agente; **inacessível para LLMs** (exige credencial autenticada de serviço/usuário).
- **Payload**: `{ version, args, onBehalfOf? (só S2S com escopo delegado), reason? }` → `200 { result }` | `202 { approvalRequestId, status: "WAITING_APPROVAL" }`.
- **Idempotência**: `Idempotency-Key` obrigatório para writes.
- **Erros**: `TOOL_CALL_INVALID`, `TOOL_DENIED`, `APPROVAL_REQUIRED`, `TOOL_TIMEOUT`.
- **Eventos**: `ai.tool.requested/validated/denied/approval_required/executed/failed`.

## 6. Execuções

### `GET /v1/executions/{executionId}`
Detalhe: status, tarefa, modelo, usage, tool calls (resumo), erro, links de aprovação; `?stream=true` retoma SSE (catch-up). Authz: dono da execução, `ai-admin`, ou serviço originador.

### `POST /v1/executions/{executionId}/cancel`
Cancelamento cooperativo → `202`; estado final `CANCELED`. Erros: `409 ALREADY_FINISHED`. Eventos: `ai.execution.canceled`.

### `POST /v1/executions/{executionId}/retry`
Reexecuta com os mesmos inputs (novo executionId encadeado por causationId): `{ reuseContext?: boolean }` → `202 { executionId }`. Regras: só `FAILED`/`CANCELED`; aprovações **não** são reaproveitadas (novos pedidos se necessário). Eventos: `ai.execution.requested` (causation = execução anterior).

## 7. Aprovações

### `GET /v1/approvals`
Fila do workspace: `?status=PENDING&mine=true` → lista com tool, parâmetros verbatim, `paramsHash`, risco, expiração. Authz: `ai-approver` (fila completa) / solicitante (as suas).

### `GET /v1/approvals/{approvalId}`
Detalhe completo (inclui execução de origem e contexto exibível). 

### `POST /v1/approvals/{approvalId}/approve`
- **Payload**: `{ paramsHash }` — o cliente **ecoa o hash exibido** (prova de que aprovou exatamente aqueles parâmetros).
- **Authz**: humano com role `ai-approver` + permissão da tool subjacente; credencial de agente/serviço ⇒ `403 NON_HUMAN_ACTOR`. Política solicitante≠aprovador conforme config.
- **Resposta**: `200 { status: "APPROVED", executionResumed: true }`.
- **Erros**: `409 PARAMS_HASH_MISMATCH` (parâmetros mudaram ⇒ pedido `INVALIDATED`), `410 APPROVAL_EXPIRED`, `409 ALREADY_DECIDED`.
- **Eventos**: `ai.approval.approved` → retomada → `ai.tool.executed` (execução única).

### `POST /v1/approvals/{approvalId}/reject`
`{ reason }` → `200 { status: "REJECTED" }`; execução de origem prossegue sem a tool (ou falha controlada, conforme política do agente). Eventos: `ai.approval.rejected`.

## 8. Contexto e conhecimento

### `POST /v1/context/build`
Monta contexto para um alvo (debug/consumo por módulos): `{ target: {recordType, recordId}, include: ["immediate","memory","rag"], budgetTokens }` → blocos com origem/citações, já filtrados por permissões do actor. Authz: `ai-user`. Uso típico: pré-visualização "o que a IA vê" no hub app (transparência).

### `POST /v1/knowledge/search`
Busca RAG direta: `{ query, filters?: {sourceType, recordRefs}, topK?, minScore? }` → `{ passages: [{content, source, score, citations}] }`. **Filtro por workspace+permissões é implícito e inescapável**. Eventos: nenhum (leitura auditada).

### `POST /v1/memory/search`
Busca em memória de cliente/organizacional: `{ query, companyRef?, topK? }` → fatos com origem/data. Mesmas garantias de filtro.

(Administração de fontes: `/v1/admin/knowledge-sources` CRUD + reindex — F6; eventos `ai.knowledge.indexed|index_failed`.)

## 9. Taxonomia de erros (transversal)

`401 UNAUTHENTICATED` · `403 FORBIDDEN` / `NON_HUMAN_ACTOR` / `WORKSPACE_MISMATCH` · `404 NOT_FOUND` (inclui recurso de outro workspace — indistinguível de inexistente) · `409` conflitos (`PARAMS_HASH_MISMATCH`, `ALREADY_DECIDED`, `ALREADY_FINISHED`) · `410 APPROVAL_EXPIRED` · `422` validação (`TOOL_CALL_INVALID`, `STRUCTURED_OUTPUT_INVALID`) · `429 RATE_LIMITED` · `503 MODEL_UNAVAILABLE` (fallback esgotado) · `504 TIMEOUT`. Tentativas bloqueadas de ação sensível geram evento auditado (`ai.tool.denied`), nunca silêncio.
