# 01 — Arquitetura Atual do Twenty (recorte de IA)

> Retrato do repositório (branch base `main`) com foco no que é relevante para a o2d-ai-platform.
> A visão geral completa do monorepo está em `docs/specs/proposal-module/01-current-architecture.md` (spec irmã) — este documento não a repete; detalha o **subsistema de IA** e os pontos de acoplamento.

## 1. Subsistema de IA nativo (`packages/twenty-server/src/engine/metadata-modules/ai/`)

| Submódulo | Responsabilidade | Arquivos-chave |
|---|---|---|
| `ai-agent/` | Entidade de agente (prompt, `modelId`, `responseFormat` jsonb, `modelConfiguration`, `isCustom`), CRUD | `entities/agent.entity.ts`, `agent.service.ts`, `agent.resolver.ts`, prompts em `constants/agent-system-prompts.const.ts` (**strings no código**) |
| `ai-agent-role/` | Permissões do agente via role (`role-target`) — o agente só age dentro da role | `ai-agent-role.service.ts` |
| `ai-agent-execution/` | Execução/persistência de turnos e mensagens (padrão UIMessage do AI SDK) | `agent-turn.entity.ts`, `agent-message.entity.ts`, `agent-message-part.entity.ts` |
| `ai-chat/` | Threads de chat, streaming via job na fila (`aiStreamQueue`) com catch-up, subscriptions GraphQL | `resolvers/agent-chat.resolver.ts`, `jobs/stream-agent-chat.job.ts`, `services/agent-chat-streaming.service.ts` |
| `ai-models/` | Registry de providers/modelos e preferências | `ai-providers.json`, `services/{ai-model-registry,provider-config,sdk-provider-factory,ai-model-preferences,default-ai-catalog,models-dev-catalog,native-tool-binder}.service.ts` |
| `ai-generate-text/` | Endpoint REST de geração | `controllers/ai-generate-text.controller.ts` |
| `ai-billing/` | Créditos de IA (custo → créditos) | `services/ai-billing.service.ts`, `compute-cost-breakdown.util.ts` |
| `ai-agent-monitor/` | Avaliação/grading de turnos | `services/agent-turn-grader.service.ts`, `jobs/evaluate-agent-turn.job.ts` |
| `ai-workspace-stats/` | Métricas de uso por workspace | `resolvers/`, `services/` |

### 1.1 Providers e modelos (ponto mais relevante)
- **Stack**: Vercel AI SDK v6 (`ai@6`) + pacotes `@ai-sdk/*` (deps em `packages/twenty-server/package.json`).
- **`sdk-provider-factory.service.ts`** suporta 8 pacotes: openai, anthropic, google, mistral, xai, amazon-bedrock, azure e **`@ai-sdk/openai-compatible`** (`createOpenAICompatible({ name, baseURL, apiKey? })` — `baseUrl` obrigatório). Constantes em `ai-models/constants/ai-sdk-package.const.ts`.
- **`provider-config.service.ts`**: providers = catálogo committed (`ai-providers.json`, templates `{{VAR}}` resolvidos via `TwentyConfigService`) **mesclado** com providers custom da config `AI_PROVIDERS` — por **instância**, não por workspace; comentário no código impede resolução de templates em custom providers ("prevent config variable exfiltration").
- Chaves/modelos default em `engine/core-modules/twenty-config/config-variables.ts` (grupo `LLM`): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `AI_MODELS_DEFAULT_{FAST,SMART,RECOMMENDED,DISABLED}`.

**Implicação:** um endpoint OpenAI-compatible local (Ollama/vLLM) já poderia ser plugado no Twenty por configuração de instância — mas sem UI por workspace, sem roteamento por tarefa, sem fallback, sem prompt registry, sem RAG/memória, sem aprovação humana e sem limites por tarefa. É funcionalidade em evolução rápida (risco de breaking changes), o que sustenta a regra de **não depender exclusivamente** dela.

### 1.2 Tool calling nativo
- `engine/core-modules/tool-provider/`: `ToolRegistryService` + `tool-executor.service.ts`; **descoberta progressiva** (`learn-tools`, `get-tool-catalog`, `execute-tool`, `load-skill`); categorias em `packages/twenty-shared/src/ai/constants/tool-category.const.ts` (`DATABASE_CRUD`, `ACTION`, `WORKFLOW`, `METADATA`, `VIEW`, `DASHBOARD`, `NAVIGATION_MENU_ITEM`, `WEBHOOK`, `LOGIC_FUNCTION`).
- Tools concretas em `engine/core-modules/tool/tools/` (`send-email-tool.ts`, `http-tool.ts` com SSRF guard via `secure-http-client`, `code-interpreter-tool.ts` (E2B), calendar, navigate, spill de outputs grandes).
- Permissões: o agente executa sob sua role (`PermissionsService.hasToolPermission`, `engine/metadata-modules/permissions/permissions.service.ts`); **não há** níveis de risco/aprovação humana — apenas exclusões estáticas no MCP.

### 1.3 MCP nativo
- `engine/api/mcp/`: `@Controller('mcp')` (`controllers/mcp-core.controller.ts`), OAuth 2.1 (`guards/mcp-auth.guard.ts` + `.well-known` em `application-oauth/controllers/oauth-discovery.controller.ts`), protocolo em `services/mcp-protocol.service.ts`, annotations de segurança (`constants/mcp-*-annotations.const.ts`), exclusões (`constants/mcp-excluded-tool-names.const.ts`: `code_interpreter`, `http_request`).
- Ecossistema: `packages/twenty-codex-plugin/` (skills de apps + `use-twenty-mcp`), `packages/twenty-claude-skills/`.

### 1.4 IA no frontend
- `packages/twenty-front/src/modules/ai/` (AgentChatProvider, AiChatTab, streaming por subscription); side panel `ask-ai`/`ai-chat-threads` (`src/modules/side-panel/pages/`).

## 2. Fundamentos multi-workspace, segurança e assíncrono (a espelhar no gateway)

- **Multi-workspace**: schema físico por workspace (`engine/workspace-manager/workspace-migration/`), `WorkspaceAuthGuard` (`engine/guards/workspace-auth.guard.ts`), caches por workspace. Auth JWT tipado (`auth/strategies/jwt.auth.strategy.ts` — ACCESS/API_KEY/APPLICATION_ACCESS/...), API keys com `jti` revogável.
- **RBAC**: role → objectPermission → fieldPermission → RLS (`engine/metadata-modules/{role,object-permission,row-level-permission-predicate}/`), flags (`permission-flag/`, `PermissionFlagType` já contém `AI`); roles para usuários, API keys e agentes.
- **Filas**: BullMQ com 17 filas (`engine/core-modules/message-queue/message-queue.constants.ts` — incl. `aiQueue`, `aiStreamQueue`), worker `src/queue-worker/queue-worker.ts`, crons, locks `cache-lock/`.
- **Webhooks**: saída assinada HMAC (`metadata-modules/webhook/jobs/call-webhook.job.ts`), entrada por rotas de logic function (`route-trigger.controller.ts` `@Controller('s')`, `server-route-trigger/`) e workflow (`workflow-trigger.controller.ts`).
- **Storage**: `file-storage/` (local/S3) + URLs assinadas (`file/file-url/file-url.service.ts`); sub-módulo `file-ai-chat`.
- **Auditoria/observabilidade**: `event-logs/` (ClickHouse sink) + `timelineActivity`; Sentry; OTel collector + Grafana como infra opcional (`packages/twenty-docker/{otel-collector,grafana}/`).
- **Testes**: unit colocated, integração (`test/integration/ai/` existe), Playwright E2E.

## 3. Plataforma de extensão (onde o hub app se apoia)

- SDK de apps: `packages/twenty-sdk/src/sdk/define/` — `defineApplication`, `defineObject`, `defineField`, `defineLogicFunction` (triggers `cron`/`databaseEvent`/`httpRoute`/`tool`/`workflowAction`), `defineFrontComponent`, `defineCommandMenuItem`, `defineAgent`, `defineSkill`, `defineRole`, `defineView`, `definePageLayout`, `defineNavigationMenuItem`, `defineConnectionProvider`, `definePermissionFlag`.
- Manifest por convenção de arquivos (`packages/twenty-shared/src/application/manifestType.ts`); exemplos reais `packages/twenty-apps/{examples/postcard,public/twenty-slack}/`.
- Front components em sandbox (`packages/twenty-front-component-renderer/` host/remote/worker) com host APIs (`useRecordId`, `openSidePanelPage`, `enqueueSnackbar`, `openCommandConfirmationModal`, `navigate`...).
- CLI `twenty dev` / `app:publish --private` (`packages/twenty-sdk/src/cli/commands/`); cliente tipado `packages/twenty-client-sdk` (core GraphQL/metadata/REST).
- Workflows com action `AI_AGENT` (`packages/twenty-shared/src/workflow/types/WorkflowActionType.ts`) e triggers webhook/cron/databaseEvent.

## 4. O que NÃO existe (verificado por busca no repositório)

| Ausência | Verificação |
|---|---|
| pgvector, embeddings, RAG, reranking | grep: zero (único hit "embedding" é `engine/utils/render-apollo-playground.util.ts`, falso positivo) |
| Ollama, vLLM, llama.cpp, LiteLLM | grep: zero |
| AgentMemory / memória persistente de cliente | inexistente (só histórico de chat) |
| Prompt registry versionado | prompts em constantes (`ai-agent/constants/agent-system-prompts.const.ts`) |
| Aprovação humana de ações de IA (hash/expiração) | inexistente |
| Fallback entre modelos / circuit breaker | inexistente |
| Rate limit de IA por workspace/tarefa/agente | inexistente (grupo `RATE_LIMITING` é genérico de API) |
| Python (FastAPI/Pydantic/Celery), RabbitMQ, Kafka, n8n, GitLab, Prometheus/Loki no server | grep: zero |

Essas ausências definem exatamente o espaço da o2d-ai-platform (`04-target-architecture.md`).
