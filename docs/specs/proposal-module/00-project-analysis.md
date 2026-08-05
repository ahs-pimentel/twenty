# 00 — Análise do Projeto Atual (Twenty CRM)

> Base de evidências para a especificação do módulo proprietário óDois de propostas comerciais.
> Toda conclusão abaixo referencia caminhos reais deste repositório. Nada foi implementado ou alterado além da criação desta documentação.

## 1. Fontes lidas

| Fonte | Caminho | Situação |
|---|---|---|
| Contrato do projeto | `CLAUDE.md` | Lido — comandos, convenções, princípios, workflow |
| README | `README.md` | Lido — visão, stack, instalação, Twenty Apps |
| Manifesto de produto/design | `PRODUCT.md`, `DESIGN.md` | Lidos — referem-se ao site de marketing (`packages/twenty-website`), não ao app |
| Licença | `LICENSE` | AGPL v3 + arquivos marcados `/* @license Enterprise */` sob licença comercial |
| Documentação | `packages/twenty-docs/` (Mintlify) — em especial `developers/extend/**` (APIs, webhooks, apps) | Lido |
| Manifests de pacote | `package.json` (raiz, Yarn 4 + Nx), `packages/twenty-server/package.json`, `packages/twenty-sdk`, `packages/twenty-shared` | Lidos |
| `pyproject.toml` / `requirements.txt` | — | **Não existem.** O repositório é 100% TypeScript; não há Python |
| Docker/Compose | `packages/twenty-docker/docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `helm/`, `k8s/`, `podman/` | Lidos |
| CI/CD | `.github/workflows/` (~40 workflows: `ci-server.yaml`, `ci-front.yaml`, `ci-twenty-apps.yaml`, `cd-deploy-main.yaml`, …) | Lidos |
| Migrations | TypeORM core + migrações de workspace geradas dinamicamente (`packages/twenty-server/src/engine/workspace-manager/workspace-migration/`); instance commands (`packages/twenty-server/docs/UPGRADE_COMMANDS.md`) | Lidos |
| Env de exemplo | `packages/twenty-server/.env.example`, `packages/twenty-front/.env.example`; fonte real de config: `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` | Lidos (sem copiar valores) |
| Auth/autorização | `packages/twenty-server/src/engine/core-modules/auth/`, `engine/metadata-modules/{role,object-permission,permission-flag}/` | Lidos |
| Integrações | `modules/messaging/`, `modules/calendar/`, `modules/connected-account*/`, `packages/twenty-zapier/` | Lidos |
| Cliente HTTP | `engine/core-modules/secure-http-client/secure-http-client.service.ts` (SSRF guard) | Lido |
| Filas | `engine/core-modules/message-queue/` (BullMQ) | Lido |
| Storage | `engine/core-modules/file-storage/`, `engine/core-modules/file/` | Lidos |
| Geração de documentos | `engine/core-modules/dpa/` (PDF via `@react-pdf/renderer`), `packages/twenty-emails/` (React Email) | Lidos |
| LLM/IA | `engine/metadata-modules/ai/`, `engine/core-modules/tool-provider/`, `engine/core-modules/tool/` | Lidos |
| Notificações | inexistentes como sistema persistente (ver §2.15) | Verificado |
| Propostas/contratos/clientes/oportunidades | `modules/{company,person,opportunity,note,task}/standard-objects/` — **não há objeto de proposta/contrato** | Verificado |
| WhatsApp/Evolution API | **nenhum código** (ver §2.11) | Verificado |

## 2. Conclusões (as 18 dimensões solicitadas)

### 2.1 Arquitetura atual
Monorepo Nx com backend NestJS multi-tenant e frontend React servido pela mesma imagem em produção. O núcleo distintivo é o **motor de metadados**: objetos e campos são linhas em tabelas de metadata (`engine/metadata-modules/object-metadata/`, `field-metadata/`) que geram, por workspace, schema físico Postgres (via `engine/workspace-manager/workspace-migration/`), schema GraphQL dinâmico (`engine/api/graphql/workspace-schema.factory.ts`) e REST espelhado (`engine/api/rest/core/controllers/rest-api-core.controller.ts`). Extensibilidade de primeira classe via **Applications/Twenty Apps** (`engine/core-modules/application/`, `packages/twenty-sdk/`), **logic functions** (`engine/metadata-modules/logic-function/`), **workflows** (`modules/workflow/`) e **agentes de IA** (`engine/metadata-modules/ai/`).

### 2.2 Linguagens, frameworks e bibliotecas
TypeScript em todos os pacotes. Backend: NestJS, TypeORM, GraphQL Yoga (code-first + schema dinâmico), BullMQ, ioredis, Vercel AI SDK (`ai@6`, `@ai-sdk/{openai,anthropic,google,mistral,xai,...}`), `@react-pdf/renderer`. Frontend: React 18, Jotai, Linaria, Lingui, Apollo Client, Vite. Evidência: `packages/twenty-server/package.json`, `packages/twenty-front/package.json`, `README.md`.

### 2.3 Serviços existentes (processos)
`server` (API, porta 3000, `/healthz`), `worker` (BullMQ, `src/queue-worker/queue-worker.ts`), `command` (CLI de manutenção, `src/command/command.ts`), Postgres 16, Redis; ClickHouse opcional para audit/analytics (`engine/core-modules/event-logs/ingest/clickhouse-event.sink.ts`). Evidência: `packages/twenty-docker/docker-compose.yml`.

### 2.4 Organização de pastas
`packages/twenty-server/src/engine/` (motor: api, core-modules, metadata-modules, workspace-*) vs `src/modules/` (domínio CRM: company, person, opportunity, messaging, calendar, workflow, timeline...). Front: `packages/twenty-front/src/modules/` (56 módulos por domínio: object-record, command-menu, side-panel, ai, front-components...). Apps de exemplo/públicos: `packages/twenty-apps/{examples,public,internal,fixtures}/`.

### 2.5 Padrões arquiteturais
Metadata-driven schema; CQRS leve na camada comum REST/GraphQL (`engine/api/common/`); eventos de domínio batch (`engine/workspace-event-emitter/`) com fan-out (webhooks, subscriptions, audit, timeline, triggers) em `engine/api/graphql/workspace-query-runner/listeners/entity-events-to-db.listener.ts`; jobs decorados `@Processor/@Process`; drivers plugáveis (storage, e-mail, fila, logic function, LLM provider); guards NestJS empilhados para authn/authz.

### 2.6 Convenções de nomenclatura
Definidas em `CLAUDE.md`: camelCase, PascalCase, SCREAMING_SNAKE_CASE, kebab-case com sufixos (`.service.ts`, `.entity.ts`, `.workspace-entity.ts`, `.job.ts`, `.resolver.ts`, `.controller.ts`, `.object.ts`/`.field.ts`/`.front-component.tsx` nos apps); named exports; types > interfaces; sem `any`; sem abreviações.

### 2.7 Autenticação
JWTs tipados (`JwtTokenTypeEnum`: ACCESS, API_KEY, APPLICATION_ACCESS, WORKSPACE_AGNOSTIC, FILE...) resolvidos por `engine/core-modules/auth/strategies/jwt.auth.strategy.ts`; estratégias Google/Microsoft/OIDC/SAML (`auth/strategies/`), SSO por workspace (`engine/core-modules/sso/`), 2FA (`engine/core-modules/two-factor-authentication/`), API keys como JWT com `jti` validado contra entidade revogável (`engine/core-modules/api-key/`).

### 2.8 Autorização e permissões
RBAC em camadas: flags globais da role (`engine/metadata-modules/role/role.entity.ts`) → permissões por objeto (`object-permission/object-permission.entity.ts`) → por campo (`object-permission/field-permission/field-permission.entity.ts`) → predicados row-level (`row-level-permission-predicate/`); flags de settings (`permission-flag/` + `packages/twenty-shared/src/constants/PermissionFlagType.ts`). Roles atribuíveis a usuários, API keys **e agentes de IA** (`role-target`). Enforcement central no query runner comum (vale para REST e GraphQL): `engine/api/common/common-query-runners/common-base-query-runner.service.ts`.

### 2.9 Banco de dados e ORM
PostgreSQL + TypeORM; schema `core` para metadados/entidades de sistema e schemas por workspace para dados; um ORM dinâmico próprio (`engine/twenty-orm/`) opera sobre entidades geradas do metadata. Campo monetário é composite `CURRENCY` (`amountMicros` NUMERIC + `currencyCode` TEXT — `packages/twenty-shared/src/types/composite-types/currency.composite-type.ts`).

### 2.10 Filas e processamento assíncrono
BullMQ sobre Redis, 17 filas nomeadas (`engine/core-modules/message-queue/message-queue.constants.ts`: `webhookQueue`, `workflowQueue`, `logicFunctionQueue`, `aiQueue`, `cronQueue`, ...); driver factory (`message-queue.module-factory.ts`); jobs `@Processor`/`@Process` (83 processors); worker dedicado `src/queue-worker/queue-worker.ts`; crons registrados na `cronQueue`; locks distribuídos em `engine/core-modules/cache-lock/`.

### 2.11 Integrações externas
E-mail (Gmail/Microsoft/IMAP-SMTP: `modules/messaging/message-import-manager/drivers/`), calendário (Google/Microsoft/CalDAV: `modules/calendar/`), Stripe (`engine/core-modules/billing*/`), AWS SES inbound (`modules/messaging-webhooks/`), Zapier (`packages/twenty-zapier/`), provedores LLM (§2.2), AWS Lambda para logic functions (`engine/core-modules/logic-function/logic-function-drivers/drivers/lambda.driver.ts`). **Não existe** integração WhatsApp/Evolution API/Twilio/SMS: as únicas ocorrências de "whatsapp" são um campo LINKS em seeds de Person (`engine/workspace-manager/dev-seeder/metadata/custom-fields/constants/person-custom-field-seeds.constant.ts`) e `MessageChannelType.SMS` declarado sem implementação (`packages/twenty-shared/src/types/MessageChannelType.ts`).

### 2.12 Webhooks
**Saída**: entidade webhook com `targetUrl`, `operations`, `secret` (`engine/metadata-modules/webhook/entities/webhook.entity.ts`); disparo assíncrono via `webhookQueue` (`webhook/jobs/call-webhook-jobs.job.ts` → `call-webhook.job.ts`) com assinatura HMAC-SHA256 (`X-Twenty-Webhook-Signature/-Timestamp/-Nonce`) e SSRF guard (`engine/core-modules/secure-http-client/`). **Entrada**: triggers de workflow (`engine/core-modules/workflow/controllers/workflow-trigger.controller.ts` — `POST /webhooks/workflows/:workspaceId/:workflowId`), rotas HTTP de logic functions (`engine/metadata-modules/route-trigger/route-trigger.controller.ts` — `@Controller('s')`; `engine/core-modules/server-route-trigger/`), SES, Google/Microsoft sync, Stripe.

### 2.13 Armazenamento de arquivos
`engine/core-modules/file-storage/` com drivers `local`/`s3` (config `STORAGE_TYPE`, `STORAGE_S3_*`); entrega por URL assinada: JWT tipo FILE (`engine/core-modules/file/file-url/file-url.service.ts`) ou presigned URL S3 (`STORAGE_S3_PRESIGNED_URL_ENABLED`); validação de path por workspace (`file-storage/utils/`).

### 2.14 Geração de PDF/HTML/DOCX
PDF real e recente: gerador de DPA (`engine/core-modules/dpa/pdf/render-dpa-to-pdf.util.ts` com `@react-pdf/renderer`; fluxo completo em `dpa/services/dpa.service.ts`: renderiza → grava no storage → persiste entidade → URL assinada de download). HTML de e-mail: `packages/twenty-emails/` (React Email). **Não há** Puppeteer/Playwright no server nem geração DOCX.

### 2.15 Observabilidade, logs e auditoria
Sentry (`engine/core-modules/exception-handler/`), OpenTelemetry collector e Grafana em `packages/twenty-docker/{otel-collector,grafana}/`; auditoria de eventos em `engine/core-modules/event-logs/` (ingest + sink ClickHouse + cleanup) condicionada a `objectMetadata.isAuditLogged`; trilha visível ao usuário no objeto `timelineActivity` (`modules/timeline/`). **Não existe** sistema de notificações in-app persistentes — apenas snackbars transitórios (`twenty-front/src/modules/ui/feedback/snack-bar-manager/`) e e-mails.

### 2.16 Testes existentes
Unit `*.spec.ts` colocalizados (`packages/twenty-server/jest.config.mjs`); integração `*.integration-spec.ts` (`packages/twenty-server/test/integration/{ai,graphql,metadata,rest,oauth,...}`, `maxWorkers: 1`, `.env.test`); E2E Playwright (`packages/twenty-e2e-testing/`); Storybook + testes visuais no front; CI por pacote (`.github/workflows/ci-*.yaml`).

### 2.17 Estratégia de deploy
Docker Compose de referência (`packages/twenty-docker/docker-compose.yml`: server + worker na mesma imagem, Postgres 16, Redis); Helm/k8s/podman; deploy do cloud oficial via dispatch para repositório `twenty-infra` (`.github/workflows/cd-deploy-main.yaml`); upgrades por instance/workspace commands (`packages/twenty-server/docs/UPGRADE_COMMANDS.md`).

### 2.18 Integração atual ou prevista com o Twenty (para o módulo)
O repositório **é** o Twenty. Os pontos de integração previstos pela própria plataforma — e que o módulo deve usar — são: Twenty Apps (`packages/twenty-sdk/src/sdk/define/`, manifest em `packages/twenty-shared/src/application/manifestType.ts`, exemplos em `packages/twenty-apps/`), REST/GraphQL (`engine/api/`), cliente tipado (`packages/twenty-client-sdk/`), webhooks de saída assinados, logic functions com triggers HTTP/tool/databaseEvent, front components sandboxed (`packages/twenty-front-component-renderer/`), agentes de IA com roles, e servidor MCP nativo (`engine/api/mcp/`).

## 3. Lacunas identificadas (o que o módulo precisa e não existe)

| # | Lacuna | Evidência de ausência |
|---|---|---|
| 1 | Integração WhatsApp/Evolution API (recepção e envio) | §2.11 — zero ocorrências de evolution/twilio; SMS sem driver |
| 2 | Objetos de proposta, itens, catálogo, template, versão, aprovação | `modules/*/standard-objects/` não contém nada equivalente |
| 3 | Máquina de estados com gate de aprovação humana e hashes | inexistente; workflows têm estados de *run*, não de documento comercial |
| 4 | Geração de PDF de proposta com marca d'água/versionamento/hash | DPA (`engine/core-modules/dpa/`) é caso único e específico; serve de referência de padrão, não de reuso direto |
| 5 | Transcrição de áudio | nenhum serviço de transcrição no server (o POC `packages/twenty-companion` usa AssemblyAI, mas é Electron desktop e "não usar em produção" segundo seu README) |
| 6 | Notificação interna persistente de "proposta aguardando revisão" | §2.15 |
| 7 | Geração DOCX | §2.14 |
| 8 | Sessões de conversa WhatsApp (agrupamento de mensagens, perguntas complementares) | inexistente |
| 9 | MCP com ferramentas de proposta e confirmação humana para ações sensíveis | MCP nativo existe (`engine/api/mcp/`), mas expõe tools genéricas de CRM; tools de proposta com gates são novas |

## 4. Componentes reutilizáveis (síntese)

1. **Plataforma de Apps** — objetos, campos, roles, views, front components, command menu, logic functions, publicação privada (`twenty app:publish --private`).
2. **RBAC completo** — roles/objectPermission/fieldPermission/permissionFlag, inclusive para API keys e agentes.
3. **REST/GraphQL dinâmicos + twenty-client-sdk** para o serviço externo ler/escrever objetos.
4. **Webhooks de saída assinados** (Twenty → Serviço de Propostas) e **rotas HTTP de logic functions** (UI → Serviço).
5. **Padrões de infraestrutura** replicáveis no serviço proprietário: BullMQ (`message-queue/`), storage S3 com URLs assinadas (`file-storage/`, `file-url/`), HMAC de webhook, locks (`cache-lock/`), retenção por cron (`event-logs/`).
6. **Stack LLM** — Vercel AI SDK v6 multi-provider, registry de modelos, padrão de billing de tokens (`ai-billing/`).
7. **Referência de geração de PDF** — pipeline DPA (`@react-pdf/renderer` → storage → URL assinada).
8. **Auditoria/timeline** — `timelineActivity` para trilha visível no CRM; `ProposalEvent` próprio para trilha técnica.
9. **Testes** — padrões unit/integration/E2E prontos para espelhar no serviço.

## 5. Decisão de tecnologia do serviço proprietário

O enunciado admite "FastAPI ou backend existente". **Não há Python no repositório** (sem `pyproject.toml`/`requirements.txt`); todo o ferramental, convenções (`CLAUDE.md`), SDKs (`twenty-client-sdk`) e padrões de fila/storage são TypeScript/NestJS. Decisão registrada: o Serviço de Propostas será **NestJS/TypeScript**, espelhando os padrões do repo (detalhes em `04-technical-spec.md`; alternativas e trade-offs em `15-open-questions.md`).
