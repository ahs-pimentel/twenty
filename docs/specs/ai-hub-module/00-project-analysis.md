# 00 — Análise do Projeto Atual (foco: plataforma de IA)

> Base de evidências para a especificação da **o2d-ai-platform** (o2d-ai-hub-app · o2d-ai-gateway · o2d-ai-contracts · o2d-ai-mcp).
> Complementa (sem repetir) a análise já feita para o módulo de propostas em `docs/specs/proposal-module/00-project-analysis.md` — as especificações são irmãs, no mesmo repositório.
> Nenhum código, dependência, migration ou configuração foi alterado; apenas esta documentação foi criada.

## 1. Fontes lidas

Além de todas as fontes já listadas em `docs/specs/proposal-module/00-project-analysis.md` §1 (CLAUDE.md, README.md, LICENSE, package.json raiz, docker, CI/CD, env examples, auth, filas, storage, testes — todas revalidadas), esta rodada aprofundou:

| Fonte | Caminho | Achado |
|---|---|---|
| Módulo de IA nativo | `packages/twenty-server/src/engine/metadata-modules/ai/` (submódulos: `ai-agent`, `ai-agent-execution`, `ai-agent-monitor`, `ai-agent-role`, `ai-billing`, `ai-chat`, `ai-generate-text`, `ai-models`, `ai-workspace-stats`) | Sistema de agentes/chat/modelos completo |
| Factory de providers | `.../ai/ai-models/services/sdk-provider-factory.service.ts` | 8 pacotes Vercel AI SDK, **incl. `@ai-sdk/openai-compatible` com `baseUrl` obrigatório** |
| Config de providers | `.../ai/ai-models/services/provider-config.service.ts` | Merge de catálogo committed + providers custom por **instância** via config `AI_PROVIDERS` (com anti-exfiltração de templates `{{VAR}}`) |
| Catálogo de modelos | `.../ai/ai-models/ai-providers.json` | openai/anthropic/google/mistral/xai com custos, contextWindow, modalities |
| Tools de agente | `packages/twenty-server/src/engine/core-modules/tool-provider/`, `core-modules/tool/tools/` | ToolRegistry com descoberta progressiva; categorias em `packages/twenty-shared/src/ai/constants/tool-category.const.ts` |
| MCP nativo | `packages/twenty-server/src/engine/api/mcp/` | OAuth 2.1, tools do registry, annotations, exclusões |
| Prompts existentes | `.../ai/ai-agent/constants/agent-system-prompts.const.ts` | **Constantes no código** — não há registro versionado |
| pgvector / embeddings / RAG / AgentMemory | grep no repositório inteiro | **Zero ocorrências** (único hit de "embedding" é falso positivo em `engine/utils/render-apollo-playground.util.ts`) |
| Ollama / vLLM / llama.cpp / LiteLLM | grep no repositório inteiro | **Zero ocorrências** |
| Celery / RabbitMQ / Kafka / n8n / FastAPI / pyproject / requirements | grep no repositório inteiro | **Zero ocorrências** — assíncrono é 100% BullMQ/Redis |
| Especificações existentes | `docs/specs/proposal-module/` (16 docs, criados nesta linha de trabalho) | Serviço de Propostas será consumidor da plataforma de IA |

## 2. Conclusões (as 22 dimensões solicitadas)

Itens 1–19 (arquitetura, linguagens, pastas, monorepo, padrões, nomenclatura, auth, authz, multi-workspace, bancos/ORM, filas, assíncrono, integrações, cache, storage, observabilidade, auditoria, testes, deploy) estão detalhados com evidências em `docs/specs/proposal-module/00-project-analysis.md` §2 e `01-current-architecture.md`. Síntese e complementos específicos de IA:

1. **Arquitetura**: monorepo Nx TypeScript; NestJS metadata-driven multi-workspace; extensão oficial via Twenty Apps/logic functions/front components.
2. **Linguagens/frameworks**: TypeScript em tudo; **não há Python** (FastAPI/Pydantic/Celery inexistentes).
3. **Organização**: `engine/` (motor) vs `modules/` (domínio); apps em `packages/twenty-apps/`.
4. **Monorepo**: sim (Nx + Yarn 4); módulos proprietários óDois ficarão em repositórios próprios.
5. **Padrões**: drivers plugáveis, eventos batch com fan-out, jobs decorados, guards empilhados.
6. **Nomenclatura**: `CLAUDE.md` (kebab-case + sufixos `.service.ts`/`.entity.ts`/`.job.ts` etc.).
7. **Autenticação**: JWTs tipados multi-estratégia (`engine/core-modules/auth/`), API keys revogáveis (`core-modules/api-key/`).
8. **Autorização**: RBAC em camadas + `permissionFlag` (o enum `PermissionFlagType` já inclui `AI` — `packages/twenty-shared/src/constants/PermissionFlagType.ts`); roles atribuíveis a usuários, API keys e **agentes** (`role-target`).
9. **Multi-workspace**: nativo — schema físico por workspace (`engine/workspace-manager/`), `WorkspaceAuthGuard`, cache por workspace. Modelo a espelhar no gateway.
10. **Banco/ORM**: PostgreSQL + TypeORM (+ twenty-orm dinâmico). **Sem pgvector.**
11. **Filas**: BullMQ, 17 filas — já existem `aiQueue` e `aiStreamQueue` (`engine/core-modules/message-queue/message-queue.constants.ts`).
12. **Assíncrono**: worker dedicado (`src/queue-worker/`), crons, locks (`cache-lock/`).
13. **Integrações externas**: e-mail/calendário/Stripe/SES/Lambda; provedores LLM cloud via AI SDK.
14. **Cache**: Redis (`cache-storage/`, TTL default 7d).
15. **Storage**: drivers local/S3 + URLs assinadas (`file-storage/`, `file/file-url/`); sub-módulo `file-ai-chat` para arquivos de chat de IA.
16. **Observabilidade**: Sentry, OTel collector + Grafana como infra opcional (`packages/twenty-docker/{otel-collector,grafana}/`). Sem Prometheus no server; sem Loki.
17. **Auditoria**: `event-logs/` (sink ClickHouse) + `timelineActivity`; IA tem grading de turnos (`ai-agent-monitor/`) e billing de créditos (`ai-billing/`).
18. **Testes**: jest unit/integration (suíte `test/integration/ai/` existe), Playwright E2E.
19. **Deploy**: compose de referência (`packages/twenty-docker/docker-compose.yml`), Helm/k8s.

**20. Integração atual com o Twenty (pontos de extensão para a plataforma):** Twenty Apps (`packages/twenty-sdk/src/sdk/define/` — incl. `defineAgent`, `defineSkill`, `defineFrontComponent`, `defineLogicFunction` com trigger `tool`), REST/GraphQL + `packages/twenty-client-sdk`, webhooks assinados, MCP nativo (`engine/api/mcp/`), workflows com action `AI_AGENT` (`packages/twenty-shared/src/workflow/types/WorkflowActionType.ts`).

**21. Integração atual com modelos de IA:**
- **Existe e é funcional**: agentes com prompt/modelo/roles (`ai-agent/`), chat com streaming via jobs (`ai-chat/`, `stream-agent-chat.job.ts`), tool calling com registry por categorias (`tool-provider/`), registry de modelos + preferências (`ai-models/`), billing por créditos (`ai-billing/`), REST de geração (`ai-generate-text/`), stats (`ai-workspace-stats/`).
- **Suporte a endpoints OpenAI-compatible já existe** no nível do provider factory (`sdk-provider-factory.service.ts` — `createOpenAICompatible`), configurado por instância via `AI_PROVIDERS` (`provider-config.service.ts`). Em tese, um Ollama/vLLM poderia ser plugado no Twenty **hoje**; porém: sem UI de administração por workspace, sem roteamento por tarefa, sem registro de prompts, sem RAG/memória, sem aprovação humana de tools, sem limites por workspace/tarefa — e trata-se de área em evolução rápida do produto (risco de breaking changes), o que motiva a regra 17 do enunciado (não depender exclusivamente dela).
- **Não existe**: embeddings/RAG/pgvector, memória de agente persistente além do histórico de chat, prompt registry versionado, fallback entre modelos, aprovação humana de ações, rate limit específico de IA por workspace/tarefa.

**22. Componentes reutilizáveis** (como **padrões a espelhar** no gateway, e como **plataforma a usar** no hub app):
- Usáveis diretamente: plataforma de Apps (hub app), RBAC/permissionFlags, REST/GraphQL/client-sdk, webhooks, logic functions, front components, command menu, MCP nativo (para CRUD genérico), workflows.
- Padrões a espelhar no gateway (sem copiar código AGPL): Vercel AI SDK v6 multi-provider (dependência npm própria), BullMQ + worker, locks distribuídos, storage assinado, HMAC de webhook, tokens JWT tipados, config em classe com grupos, outbox/eventos com correlationId, billing de uso.

## 3. Lacunas identificadas (o que a plataforma precisa e não existe)

| # | Lacuna | Evidência de ausência |
|---|---|---|
| 1 | Gateway central de IA (roteamento por tarefa, abstração de providers p/ consumidores) | consumidores atuais do Twenty chamam o registry interno; nada existe fora do Twenty |
| 2 | Conexão com LLM local (Ollama/vLLM/llama.cpp) configurada e operada | zero ocorrências; suporte genérico openai-compatible existe mas sem operação local |
| 3 | pgvector, embeddings, RAG, reranking | zero ocorrências |
| 4 | Memória de cliente/organizacional (AgentMemory) | inexistente (há só histórico de chat em `ai-agent-execution/`) |
| 5 | Prompt registry versionado com estados e testes | prompts são constantes no código (`agent-system-prompts.const.ts`) |
| 6 | Aprovação humana de ações de IA com hash de parâmetros/expiração | inexistente (apenas modal de confirmação de UI no command menu) |
| 7 | Tool registry com níveis de risco e allowlist por agente | categorias existem (`tool-category.const.ts`), níveis de risco/aprovação não |
| 8 | Fallback entre modelos e circuit breaker | inexistente |
| 9 | Limites/custos por usuário/role/workspace/tarefa/modelo | `ai-billing` cobre créditos por workspace; sem limites por tarefa/role/agente |
| 10 | Auditoria de execução de IA com correlation/causation exportável | grading/stats internos; não no formato exigido |
| 11 | MCP com tools de negócio óDois (o2d.*) e confirmação humana | MCP nativo expõe tools genéricas de CRM |
| 12 | Contratos versionados compartilhados (JSON Schema) | inexistente como pacote |

## 4. Decisão de tecnologia (registro)

O enunciado sugere FastAPI para o gateway. **Não há Python no repositório**; todo o ferramental (AI SDK v6 com `openai-compatible`, BullMQ, zod, client-sdk tipado do Twenty, convenções do `CLAUDE.md`) é TypeScript. Recomendação: **o2d-ai-gateway em NestJS/TypeScript**, com o pacote `o2d-ai-contracts` baseado em **JSON Schema (language-neutral)** — o que mantém a porta aberta para um gateway FastAPI/Pydantic sem mudar contratos, caso a óDois decida por Python. Decisão final registrada como pendente em `24-open-questions.md`.
