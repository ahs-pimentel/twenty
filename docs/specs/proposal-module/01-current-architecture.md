# 01 — Arquitetura Atual do Twenty (estado do repositório)

> Retrato do repositório na data desta análise (branch base `main`). Tudo aqui é **estado atual**, com evidências; a arquitetura proposta do módulo está em `04-technical-spec.md`.

## 1. Visão geral do monorepo

```
packages/
├── twenty-server/                  # NestJS — API, motor de metadados, filas, integrações
├── twenty-front/                   # React 18 — SPA do CRM (Jotai, Linaria, Lingui)
├── twenty-shared/                  # Tipos e utilitários comuns (FieldMetadataType, manifest de apps, workflow types)
├── twenty-ui/                      # Biblioteca de componentes
├── twenty-emails/                  # Templates React Email
├── twenty-sdk/                     # SDK + CLI de Twenty Apps (defineObject/defineField/... + `twenty` CLI)
├── twenty-apps/                    # Catálogo de apps (examples/, public/, internal/, fixtures/)
├── create-twenty-app/              # Scaffold de apps
├── twenty-client-sdk/              # Cliente tipado (core GraphQL, metadata, REST)
├── twenty-front-component-renderer/# Sandbox (host/remote/worker) de front components de apps
├── twenty-cli/                     # [DEPRECIADO] → twenty-sdk
├── twenty-docker/                  # Compose, Dockerfiles, helm/, k8s/, grafana/, otel-collector/
├── twenty-docs/                    # Documentação Mintlify (developers/extend/** para apps/API/webhooks)
├── twenty-e2e-testing/             # Playwright E2E
├── twenty-zapier/ · twenty-website/ · twenty-companion/ (POC Electron) · twenty-utils/
```

Gerência: Nx (`nx.json`) + Yarn 4 (`package.json` raiz). Licença: AGPL v3 com arquivos `/* @license Enterprise */` sob licença comercial (`LICENSE`).

## 2. Backend (`packages/twenty-server`)

### 2.1 Motor de metadados (o coração do Twenty)
- Objetos/campos como dados: `src/engine/metadata-modules/object-metadata/`, `field-metadata/` (25 tipos em `packages/twenty-shared/src/types/FieldMetadataType.ts`; composites como `CURRENCY = {amountMicros, currencyCode}` em `packages/twenty-shared/src/types/composite-types/currency.composite-type.ts`).
- Mudanças de metadata geram migrações DDL reais por workspace: `src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service.ts`.
- Relacionamentos: campos `RELATION`/`MORPH_RELATION` com `relationTargetObjectMetadataId` (`field-metadata/field-metadata.entity.ts`).
- Standard objects do CRM tipados em `src/modules/*/standard-objects/*.workspace-entity.ts` (company, person, opportunity, note, task, attachment, timelineActivity, workflow*...). `opportunity` tem `amount: CURRENCY`, `stage: SELECT`, relações `pointOfContact`/`company`/`owner`.

### 2.2 Camada de API
- **GraphQL dinâmico** por workspace: `src/engine/api/graphql/workspace-schema.factory.ts` + geradores/resolvers em `workspace-schema-builder/` e `workspace-resolver-builder/` (findMany/createOne/updateOne/.../merge/groupBy).
- **REST espelhado**: `src/engine/api/rest/core/controllers/rest-api-core.controller.ts` (`/rest/*`, `/rest/batch/*`, `/rest/*/duplicates`) convertendo para a **camada comum** `src/engine/api/common/` (mesmos query runners para REST e GraphQL — permissões aplicadas uma única vez em `common-query-runners/common-base-query-runner.service.ts`).
- **Metadata API**: GraphQL próprio + REST `/rest/metadata/...` (objects, fields, views, webhooks, apiKeys...).
- **OpenAPI dinâmica**: `src/engine/core-modules/open-api/open-api.service.ts`.
- **MCP nativo**: `src/engine/api/mcp/controllers/mcp-core.controller.ts` (`@Controller('mcp')`, OAuth 2.1 via `guards/mcp-auth.guard.ts`), protocolo em `services/mcp-protocol.service.ts` (initialize, tools/list, tools/call), tools do `ToolRegistryService` + meta-tools `get_tool_catalog`/`execute_tool`; exclusões de segurança em `constants/mcp-excluded-tool-names.const.ts` (`code_interpreter`, `http_request`).

### 2.3 Autenticação e autorização
- Estratégias: `src/engine/core-modules/auth/strategies/` (JWT, Google, Microsoft, OIDC, SAML); tokens tipados em `auth/token/services/` (ACCESS, API_KEY, APPLICATION_ACCESS, WORKSPACE_AGNOSTIC, transient, login); API keys revogáveis (`src/engine/core-modules/api-key/`); 2FA; SSO por workspace (`sso/`).
- Guards: `src/engine/guards/` (`jwt-auth.guard.ts`, `workspace-auth.guard.ts`, `custom-permission.guard.ts`, `settings-permission.guard.ts`...).
- RBAC: role com flags globais (`src/engine/metadata-modules/role/role.entity.ts`) → `objectPermission` por objeto → `fieldPermission` por campo → predicados row-level (`row-level-permission-predicate/`); flags de settings (`permission-flag/`, tipos em `packages/twenty-shared/src/constants/PermissionFlagType.ts`); roles atribuíveis a usuários, API keys e agentes de IA via `role-target`.

### 2.4 Assíncrono e infraestrutura
- **Filas BullMQ**: enum `MessageQueue` com 17 filas (`src/engine/core-modules/message-queue/message-queue.constants.ts`); decorators `@Processor`/`@Process`; worker dedicado `src/queue-worker/queue-worker.ts`; crons na `cronQueue` (`src/engine/core-modules/cron/`).
- **Redis**: `src/engine/core-modules/redis-client/redis-client.service.ts` (clientes para fila, cache e pub/sub GraphQL); cache `cache-storage/`; locks `cache-lock/`; sessões `session-storage/`.
- **Storage**: `src/engine/core-modules/file-storage/` (drivers `local.driver.ts`/`s3.driver.ts`, wrapper de validação); entrega por JWT tipo FILE (`file/file-url/file-url.service.ts`) ou presigned URL S3.
- **HTTP seguro**: `src/engine/core-modules/secure-http-client/secure-http-client.service.ts` (proteção SSRF para webhooks/actions).

### 2.5 Eventos, webhooks e auditoria
- Emissor: `src/engine/workspace-event-emitter/workspace-event-emitter.ts` (eventos batch `objeto.acao`: created/updated/deleted/destroyed/restored/upserted).
- Fan-out: `src/engine/api/graphql/workspace-query-runner/listeners/entity-events-to-db.listener.ts` → subscriptions GraphQL, `webhookQueue`, triggers de logic function/workflow, audit e timeline.
- **Webhooks de saída**: `src/engine/metadata-modules/webhook/` — HMAC-SHA256 (`X-Twenty-Webhook-Signature` = HMAC(secret, `timestamp:payload`), `-Timestamp`, `-Nonce`), retry 3x, filtro por `operations` (`*.*`, `objeto.acao`).
- **Webhooks de entrada**: workflow trigger (`src/engine/core-modules/workflow/controllers/workflow-trigger.controller.ts`), rotas de logic function (`src/engine/metadata-modules/route-trigger/route-trigger.controller.ts` — `@Controller('s')`; `src/engine/core-modules/server-route-trigger/`), SES (`src/modules/messaging-webhooks/`), Google/Microsoft (`src/modules/connected-account-sync-webhooks/`), Stripe (`billing-webhook/`).
- **Auditoria**: `src/engine/core-modules/event-logs/` (ingest → ClickHouse sink, cleanup por cron) para objetos com `isAuditLogged`; trilha visível = objeto `timelineActivity` (`src/modules/timeline/services/timeline-activity.service.ts`).

### 2.6 IA nativa
- Agentes: `src/engine/metadata-modules/ai/ai-agent/entities/agent.entity.ts` (prompt, modelId, responseFormat jsonb); execução `ai-agent-execution/` (turnos/mensagens persistidos); roles de agente `ai-agent-role/`; grading `ai-agent-monitor/`; créditos `ai-billing/`.
- Modelos: registry declarativo `ai-models/ai-providers.json` (openai/anthropic/google/mistral/xai com custos e limites) + `sdk-provider-factory.service.ts`; deps `ai@6` + `@ai-sdk/*`; chaves em `src/engine/core-modules/twenty-config/config-variables.ts` (grupo `LLM`).
- Chat: `ai-chat/` (threads, streaming via job `stream-agent-chat.job.ts` na `aiStreamQueue`, subscriptions GraphQL).
- Ferramentas: `src/engine/core-modules/tool-provider/` (ToolRegistryService; categorias em `packages/twenty-shared/src/ai/constants/tool-category.const.ts`) e tools concretas em `src/engine/core-modules/tool/tools/` (send-email, http, code-interpreter, calendar...). Agentes obedecem à role atribuída.

### 2.7 Workflows e logic functions
- Workflows: `src/modules/workflow/` — triggers `DATABASE_EVENT | MANUAL | CRON | WEBHOOK` (`workflow-trigger/types/workflow-trigger.type.ts`); actions em `packages/twenty-shared/src/workflow/types/WorkflowActionType.ts` (CODE, LOGIC_FUNCTION, SEND_EMAIL, CREATE/UPDATE/UPSERT/FIND_RECORDS, HTTP_REQUEST, AI_AGENT, ITERATOR, IF_ELSE, DELAY, FORM...); versionamento (`workflow-version.workspace-entity.ts`) e runs com estado congelado (`workflow-run.workspace-entity.ts`).
- Logic functions: metadata em `src/engine/metadata-modules/logic-function/`; execução `src/engine/core-modules/logic-function/` com drivers `LOCAL`/`LAMBDA`/`DISABLED`; triggers cron, databaseEvent, httpRoute, tool (para agentes) e workflowAction.
- Applications: `src/engine/core-modules/application/` (manifest, sync, install, marketplace, OAuth de app, tokens `APPLICATION_ACCESS`).

## 3. Plataforma de Twenty Apps (extensão sem tocar o core)

- Definição como código: `packages/twenty-sdk/src/sdk/define/index.ts` — `defineApplication`, `defineObject`, `defineField` (FieldType/RelationType/OnDeleteAction), `defineLogicFunction` (+pre/post-install), `defineFrontComponent`, `defineCommandMenuItem`, `defineAgent`, `defineSkill`, `defineRole`/`defineApplicationRole`, `defineView`, `definePageLayout`, `defineNavigationMenuItem`, `defineConnectionProvider`, `definePermissionFlag`.
- Manifest (gerado por convenção de arquivos, não escrito à mão): tipos em `packages/twenty-shared/src/application/manifestType.ts`; estrutura real de app em `packages/twenty-apps/examples/postcard/src/` (`application.config.ts`, `objects/*.object.ts`, `fields/*.field.ts`, `logic-functions/`, `components/*.front-component.tsx`, `roles/`, `views/`, `page-layouts/`, `navigation-menu-items/`).
- Front components: executados em sandbox (`packages/twenty-front-component-renderer/` — host/remote/worker); APIs de host no SDK (`useRecordId`, `useSelectedRecordIds`, `openSidePanelPage`, `enqueueSnackbar`, `openCommandConfirmationModal`, `navigate`...); pontos de montagem: side panel (`twenty-front/src/modules/side-panel/pages/front-component/`), widget de page layout e command menu headless.
- CLI: `packages/twenty-sdk/src/cli/commands/` — `twenty dev`, `dev:build`, `dev:add <entity>`, `app:publish [--private]`, `app:install`, `docker:*`, `remote:*`.
- Cliente para apps/integracões: `packages/twenty-client-sdk` (CoreApiClient GraphQL, MetadataApiClient, RestApiClient).
- Docs oficiais: `packages/twenty-docs/developers/extend/apps/**`.

## 4. Frontend (`packages/twenty-front`)

56 módulos em `src/modules/`; os relevantes para o módulo de propostas: `object-record/` (tabelas, boards, record show com page layouts), `side-panel/`, `command-menu/` + `command-menu-item/` (ações rápidas com modal de confirmação), `front-components/` (renderer de componentes de apps), `ai/` (chat de agente), `navigation/`, `settings/`. Notificações: apenas snackbars transitórios (`src/modules/ui/feedback/snack-bar-manager/`).

## 5. Deploy, configuração e qualidade

- Compose de referência: `packages/twenty-docker/docker-compose.yml` (server 3000 + worker `yarn worker:prod` na mesma imagem, postgres:16, redis, volumes `db-data`/`server-local-data`); helm/k8s/podman; observabilidade opcional (grafana/, otel-collector/); ClickHouse para audit quando habilitado.
- Config: classe `ConfigVariables` (`src/engine/core-modules/twenty-config/config-variables.ts`) com grupos (STORAGE_CONFIG, LLM, RATE_LIMITING, TOKENS_DURATION, LOGIC_FUNCTION_CONFIG...); `.env.example` mínimo.
- CI: `.github/workflows/ci-{server,front,shared,sdk,twenty-apps,e2e-main,...}.yaml`; deploy cloud via `cd-deploy-main.yaml` (dispatch a `twenty-infra`).
- Testes: unit jest colocalizado, integração com banco (`packages/twenty-server/test/integration/`), E2E Playwright (`packages/twenty-e2e-testing/`); pirâmide 70/20/10 e demais convenções em `CLAUDE.md`.
- Migrações: TypeORM core + instance/workspace commands (`packages/twenty-server/docs/UPGRADE_COMMANDS.md`).

## 6. O que NÃO existe (relevante ao módulo)

| Ausência | Verificação |
|---|---|
| WhatsApp / Evolution API / Twilio / SMS driver | grep no repo: só campo LINKS `whatsapp` em seeds de Person e `MessageChannelType.SMS` sem uso |
| Objetos de proposta/contrato/catálogo de serviços | `src/modules/*/standard-objects/` |
| Notificações in-app persistentes | apenas snackbars + e-mails |
| Geração DOCX; HTML→PDF via navegador | só `@react-pdf/renderer` (DPA) |
| Transcrição de áudio no server | só no POC desktop `twenty-companion` (AssemblyAI; "não usar em produção") |
| Python/FastAPI/Celery | repositório 100% TypeScript |
| n8n | nenhuma referência no repositório |
