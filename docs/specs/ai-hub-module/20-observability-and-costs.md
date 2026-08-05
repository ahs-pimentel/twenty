# 20 — Observabilidade e Custos

> Plataforma o2d-ai-platform · componentes: **o2d-ai-gateway** (Audit/Usage/Rate Limit/Health Check Services) + infra de observabilidade própria (doc 21).
> Status: especificação — **nada aqui está implementado**. Marcações: **[ATUAL]** = existe no repositório Twenty (caminhos reais); **[PROPOSTO]** = arquitetura da plataforma óDois.
> Dúvidas em aberto → doc 24. Canon: `CANON-AI`.

## 1. Estado atual do Twenty [ATUAL]

| O que existe | Caminho real | Observação |
|---|---|---|
| OTel Collector (infra de referência) | `packages/twenty-docker/otel-collector/` | Infra opcional do compose do Twenty — a plataforma monta a **sua própria**, no compose da óDois (doc 21); `packages/twenty-docker/` nunca é alterado |
| Grafana (infra de referência) | `packages/twenty-docker/grafana/` | Idem |
| Sentry no server | integração existente no twenty-server | Mesmo padrão adotado no gateway |
| Prometheus | **não existe no server** (grep confirmado) | Métricas Prometheus são novidade do gateway |

## 2. Logs estruturados [PROPOSTO]

- **Formato**: JSON por linha (um evento de log por linha), coletado pelo **Loki**.
- **Campos obrigatórios**: `timestamp`, `level`, `service` (gateway/worker/mcp), `workspaceId`, `correlationId`, `causationId?`, `executionId?`, `actor` (id/kind, nunca token), `message`, `context`.
- **Mascaramento (obrigatório, cenário 17 do doc 22)**: redator central aplicado **antes** do sink — API keys/secrets (padrões conhecidos + denylist de nomes de campo `apiKey|secret|token|authorization|password`), PII configurável (e-mail/telefone → hash truncado). Conteúdo de prompt/resposta **não** vai para log em nível INFO — apenas `inputHash`/`outputHash`; nível DEBUG com conteúdo só em dev, nunca em produção.
- Erros não tratados → **Sentry** (com `correlationId` como tag para pivot Loki ⇄ Sentry ⇄ trace).

## 3. Traces OTel [PROPOSTO]

Um trace por requisição ao gateway; `traceId` correlacionado ao `correlationId`. **Um span por etapa do pipeline**:

```
o2d.request
├── o2d.auth            (Authentication + Authorization + Workspace Resolver)
├── o2d.route           (Model Router: tarefa → alias → modelo; atributos: task, alias, modelId, fallback)
├── o2d.context         (Context Builder: RAG search, memória; atributos: chunks, fontes)
├── o2d.inference       (chamada ao provider; atributos: providerId, modelId, tokensIn/Out, ttfbMs)
├── o2d.validation      (Structured Output Validator; atributos: schema, retriesUsed, valid)
└── o2d.tools           (um span filho por tool call: validate → policy → [approval wait] → execute)
```

Exportados via OTel Collector próprio da plataforma; atributos nunca contêm conteúdo de prompt nem segredos (mesmo redator do §2).

## 4. Métricas Prometheus [PROPOSTO]

Endpoint `/metrics` no gateway, no worker e no o2d-ai-mcp. Nomes sugeridos (prefixo `o2d_ai_`):

| Métrica | Tipo | Labels | O que mede |
|---|---|---|---|
| `o2d_ai_inference_duration_seconds` | histogram | `model, provider, task, workspace` | Latência de inferência (inclui TTFB como bucket separado em streaming) |
| `o2d_ai_tokens_total` | counter | `direction (in\|out), model, task, workspace` | Tokens consumidos/gerados |
| `o2d_ai_requests_total` | counter | `endpoint, status, workspace` | Requisições por endpoint /v1 |
| `o2d_ai_fallback_total` | counter | `from_provider, to_provider, external, reason` | Fallbacks executados (cenários 11/12) |
| `o2d_ai_structured_output_invalid_total` | counter | `task, schema, final (bool)` | Saídas inválidas (antes e após retry de correção) |
| `o2d_ai_tool_calls_total` | counter | `tool, risk, outcome (executed\|denied\|approval_required\|failed)` | Pipeline de tools |
| `o2d_ai_tool_denied_total` | counter | `tool, denied_by (schema\|user\|workspace\|role\|policy)` | Negações (sinal de segurança) |
| `o2d_ai_approval_pending` | gauge | `workspace, risk` | Aprovações aguardando decisão |
| `o2d_ai_approval_decision_duration_seconds` | histogram | `decision` | Tempo até decidir |
| `o2d_ai_queue_jobs` | gauge | `queue, state (waiting\|active\|delayed\|failed)` | Filas BullMQ do gateway |
| `o2d_ai_queue_wait_duration_seconds` | histogram | `queue` | Espera na fila |
| `o2d_ai_provider_up` | gauge | `provider` | Health check (1/0) |
| `o2d_ai_estimated_cost_micros_total` | counter | `workspace, model, task, provider` | Custo estimado acumulado (§6) |
| `o2d_ai_rate_limited_total` | counter | `scope (user\|role\|workspace\|agent\|task\|model), origin` | 429 emitidos |
| GPU | — | — | **Métricas nativas do vLLM** (`vllm:num_requests_running`, `vllm:gpu_cache_usage_perc`, `vllm:time_to_first_token_seconds`, …) raspadas diretamente pelo Prometheus no host GPU |

## 5. Dashboards, alertas e health checks [PROPOSTO]

**Grafana** (datasources: Prometheus + Loki + traces):

| Dashboard | Recortes |
|---|---|
| Visão por workspace | Requisições, tokens, custo estimado, aprovações pendentes, negações de tool |
| Visão por modelo | Latência p50/p95/p99, tokens/s, taxa de erro, fallback, saturação GPU (vLLM) |
| Visão por tarefa | `proposal.extract`, `proposal.write`, `meeting.summarize`, … — volume, latência, taxa de structured output inválido |
| Operação | Filas BullMQ, outbox lag, DLQ, health de providers |

**Alertas** (Alertmanager):

| Alerta | Condição sugerida |
|---|---|
| Provider offline | `o2d_ai_provider_up == 0` por > 2 min (evento `ai.provider.offline`, doc 18) |
| Fila crescendo | `o2d_ai_queue_jobs{state="waiting"}` crescente por 10 min ou DLQ > 0 |
| Taxa de erro | Erros/requisições > limiar por tarefa (5xx + `MODEL_UNAVAILABLE`) |
| Custo anômalo | Derivada de `o2d_ai_estimated_cost_micros_total` por workspace acima de banda histórica |
| Structured output degradado | `invalid_total{final="true"}` > limiar (sinal de regressão de prompt/modelo) |

**Health checks**: `GET /v1/health` do gateway agrega Postgres, Redis, providers (Health Check Service) com estados `ok|degraded|down`; probes de liveness/readiness por container (doc 21).

## 6. Custos e `ai_usage_record` [PROPOSTO]

Registrar **sempre, mesmo com LLM local** — GPU, energia e capacidade têm custo; sem medição não há limite nem planejamento.

Campos de `ai_usage_record` (Postgres do gateway, doc 16):

| Campo | Conteúdo |
|---|---|
| `executionId`, `workspaceId`, `userId/actor`, `agentId?`, `task`, `providerId`, `modelId` | Dimensões |
| `tokensIn`, `tokensOut` | Tokens medidos |
| `gpuTimeMs` | Tempo de GPU (via métricas do vLLM; `null` em Ollama sem medição) |
| `durationMs`, `queueWaitMs` | Duração total e espera em fila |
| `memoryPeakMb?` | Quando disponível |
| `estimatedCostMicros` + `currencyCode` | Custo estimado (micros — paridade com o composite CURRENCY do Twenty) |
| `fallbackUsed`, `externalProvider` | Se caiu em fallback e se foi externo |
| `occurredAt` | Base de agregação por período |

**Tabela de custo por modelo** (Model Registry): para modelo **local**, custo amortizado por 1M tokens = (amortização do hardware GPU + energia + operação) ÷ throughput estimado — valores **estimativas configuráveis**, revisadas periodicamente; para provider **externo**, preço de tabela do provider. O Usage Service multiplica tokens × tabela na escrita do registro.

Referência conceitual [ATUAL]: `packages/twenty-server/src/engine/metadata-modules/ai/ai-billing/` (créditos, dollar-to-credit) — a plataforma adota **padrão análogo com implementação própria** no gateway (não reutiliza o código nem depende da IA nativa — regra 17).

## 7. Limites (Rate Limit Service + Usage Service) [PROPOSTO]

Limites configuráveis por dimensão × período, avaliados no início do pipeline:

| Dimensão | Exemplos de limite | Período |
|---|---|---|
| Usuário | requisições/h, tokens/dia | minuto/hora/dia/mês |
| Role | tetos maiores para admin, menores para viewer | idem |
| Workspace | orçamento de custo estimado/mês, tokens/dia | idem |
| Agente | execuções/h por agente | idem |
| Tarefa | ex.: `proposal.extract` limitada por hora | idem |
| Modelo | proteção de capacidade do modelo local (requisições concorrentes) | instantâneo |

**Ações por excedente** (configuráveis por regra):

1. **Throttle** — resposta `429` com `Retry-After` + evento + `o2d_ai_rate_limited_total`.
2. **Alerta** — notificação a admins do workspace (hub app) sem bloquear.
3. **Bloqueio** — corte do escopo até reset do período ou liberação manual auditada (para orçamento de custo estourado).

Estado dos contadores no Redis (janela deslizante); persistência agregada em `ai_usage_record` para relatório e auditoria. [ATUAL] O Twenty possui apenas grupo genérico `RATE_LIMITING` em config — não há rate limiting específico de IA no repositório (grep confirmado); tudo desta seção é novo, no gateway.
