# 06 — App óDois: Twenty App proprietário (`o2d-ai-hub`)

> Plataforma o2d-ai-platform — arquitetura **proposta** (não implementada), construída sobre a plataforma de apps **real** do Twenty.
> Convenção deste documento: seções marcadas **[ATUAL]** descrevem o que existe no repositório (com caminhos reais); seções **[PROPOSTO]** descrevem o app a ser construído.
> Documento irmão do `docs/specs/proposal-module/10-twenty-app-spec.md` — mesmas convenções, mesma plataforma de apps.

## 1. [ATUAL] Plataforma de apps do Twenty

Tudo o que o `o2d-ai-hub` precisa já existe como API pública da plataforma de apps:

| Componente | O que é | Caminho real |
|---|---|---|
| SDK de definição | `defineApplication`, `defineObject`, `defineField`, `defineLogicFunction`, `defineFrontComponent`, `defineCommandMenuItem`, `defineAgent`, `defineRole`, `defineApplicationRole`, `defineView`, `definePageLayout`, `definePageLayoutTab`, `defineNavigationMenuItem`, `defineConnectionProvider`, `definePermissionFlag`, `defineSkill` | `packages/twenty-sdk/src/sdk/define/index.ts` |
| Manifest por convenção de arquivos | `application.config.ts`, `objects/*.object.ts`, `fields/*.field.ts`, `logic-functions/*.ts`, `components/*.front-component.tsx`, `roles/*.role.ts`, `views/*.view.ts`, `page-layouts/*.page-layout.ts`, `navigation-menu-items/*.navigation-menu-item.ts`, `agents/*.agent.ts` | Tipos em `packages/twenty-shared/src/application/manifestType.ts`; exemplo completo em `packages/twenty-apps/examples/postcard/src/` |
| Variáveis de aplicação e de servidor | `applicationVariables` (podem ser lidas no front via `getApplicationVariable`) e `serverVariables` (`isSecret: true` — só acessíveis a logic functions no servidor) | `packages/twenty-apps/examples/postcard/src/application.config.ts` (`POSTCARD_API_KEY` com `isSecret: true`) |
| Sandbox de front components | Renderizador isolado (host/remote/worker) dos componentes de app | `packages/twenty-front-component-renderer/`; montagem em side panel em `packages/twenty-front/src/modules/side-panel/pages/front-component/` |
| APIs de host do front component | `hooks/`: `useRecordId`, `useSelectedRecordIds`, `useUserId`, `useColorScheme`, `useFrontComponentId`, `useFrontComponentExecutionContext`; `functions/`: `openCommandConfirmationModal`, `openSidePanelPage`, `enqueueSnackbar`, `navigate`, `closeSidePanel`, `copyToClipboard`, `getApplicationVariable`, `updateProgress`, `unmountFrontComponent` | `packages/twenty-sdk/src/sdk/front-component/` |
| Logic functions | Triggers reais: `cronTriggerSettings`, `databaseEventTriggerSettings`, `httpRouteTriggerSettings` (`path`, `httpMethod`, `isAuthRequired`), `serverRouteTriggerSettings`, `toolTriggerSettings`, `workflowActionTriggerSettings` | `packages/twenty-sdk/src/sdk/define/logic-functions/`, `packages/twenty-shared/src/application/logicFunctionManifestType.ts`; rotas autenticadas em `packages/twenty-server/src/engine/metadata-modules/route-trigger/route-trigger.controller.ts` |
| Client SDK tipado | `CoreApiClient`, `MetadataApiClient`, `RestApiClient` — usados em logic functions e front components (padrão real: `packages/twenty-apps/examples/postcard/src/components/card.front-component.tsx`) | `packages/twenty-client-sdk/` |
| CLI | `twenty dev`, `app:publish [--private]`, `app:install` | `packages/twenty-sdk/src/cli/commands/` |
| Roles e permissões de app | `defineRole`/`defineApplicationRole` com `objectPermissions`, `fieldPermissions`; `PermissionFlag` reexportado de `twenty-shared/constants` (inclui o flag `AI`) | `packages/twenty-sdk/src/sdk/define/roles/role-config.ts`, `.../roles/permission-flag-type.ts`, `.../permission-flags/define-permission-flag.ts` |

## 2. [ATUAL] IA nativa do Twenty — e por que o hub NÃO depende dela

O Twenty tem um módulo de IA real e funcional: `packages/twenty-server/src/engine/metadata-modules/ai/` (ai-agent, ai-agent-execution, ai-chat com streaming via `stream-agent-chat.job.ts`, ai-models com `sdk-provider-factory.service.ts` cobrindo 8 pacotes `@ai-sdk/*` incluindo `openai-compatible`), tools em `engine/core-modules/tool-provider/` e `engine/core-modules/tool/tools/`, e frontend em `packages/twenty-front/src/modules/ai/` (`AgentChatProvider`, `AiChatTab`, side panel `ask-ai`/`ai-chat-threads`).

**Regra 17 (canon, decisão 3):** a plataforma o2d **não depende** dessa IA nativa. Ela pode ficar desabilitada no workspace da óDois sem impacto:

| Aspecto | IA nativa do Twenty | o2d-ai-hub (proposto) |
|---|---|---|
| Motor | `ai-chat`/`ai-agent` do core, créditos `ai-billing` | Front components próprios → logic functions proxy → **o2d-ai-gateway** |
| Providers | Config por instância (`AI_PROVIDERS`, chaves em `config-variables.ts`) | Provider Registry do gateway (por workspace, local-first) |
| Tools | `tool-provider/` do core | Tool Registry do gateway (pipeline do doc 05) |
| Aprovação humana | Inexistente (só confirmação de UI) | `AIApprovalRequest` no gateway (doc 15) |
| Controle | Comunidade Twenty | óDois (regra 18) |

O MCP nativo do Twenty (`engine/api/mcp/`) permanece disponível para CRUD genérico; as tools `o2d.*` vivem no `o2d-ai-mcp` (doc 19).

## 3. [PROPOSTO] Estrutura do app `o2d-ai-hub`

Segue a convenção real de `packages/twenty-apps/examples/postcard/src/`:

```
o2d-ai-hub/
├── package.json                          # dep: twenty-sdk (versão fixada)
├── src/
│   ├── application.config.ts             # defineApplication({ universalIdentifier, displayName: 'óDois AI Hub',
│   │                                     #   serverVariables: { O2D_GATEWAY_URL, O2D_GATEWAY_SERVICE_SECRET (isSecret) } })
│   ├── constants/
│   │   └── universal-identifiers.ts      # UUIDs v4 estáveis de todas as entidades
│   ├── objects/
│   │   └── ai-approval-notification.object.ts   # OPCIONAL — ver §7
│   ├── fields/                           # (vazio no MVP — nenhuma extensão de objeto padrão necessária)
│   ├── roles/
│   │   ├── ai-user.role.ts
│   │   ├── ai-approver.role.ts
│   │   ├── ai-admin.role.ts
│   │   └── hub-function.role.ts          # role das logic functions do app
│   ├── views/
│   │   └── ai-approval-notifications.view.ts    # só se o objeto opcional existir (pitfall do postcard/CLAUDE.md)
│   ├── page-layouts/
│   │   └── ai-hub-home.page-layout.ts    # dashboard do hub (widgets: métricas, execuções, status)
│   ├── navigation-menu-items/
│   │   └── ai-hub.navigation-menu-item.ts
│   ├── components/
│   │   ├── ai-chat-panel.front-component.tsx
│   │   ├── ai-actions-menu.front-component.tsx
│   │   ├── ai-approvals-inbox.front-component.tsx
│   │   ├── ai-executions-list.front-component.tsx
│   │   ├── ai-admin-providers.front-component.tsx
│   │   ├── ai-admin-models.front-component.tsx
│   │   ├── ai-admin-prompts.front-component.tsx
│   │   ├── ai-admin-agents.front-component.tsx
│   │   ├── ai-admin-tools.front-component.tsx
│   │   ├── ai-metrics-dashboard.front-component.tsx
│   │   └── ai-service-status.front-component.tsx
│   ├── command-menu-items/
│   │   ├── company-summarize-relationship.command-menu-item.ts
│   │   ├── company-identify-pending.command-menu-item.ts
│   │   ├── company-prepare-meeting.command-menu-item.ts
│   │   ├── proposal-extract-scope.command-menu-item.ts
│   │   ├── proposal-improve-text.command-menu-item.ts
│   │   ├── proposal-compare-versions.command-menu-item.ts
│   │   ├── proposal-generate-preview.command-menu-item.ts
│   │   ├── project-summarize-status.command-menu-item.ts
│   │   ├── project-identify-risks.command-menu-item.ts
│   │   └── project-generate-report.command-menu-item.ts
│   └── logic-functions/
│       ├── proxy-chat.ts                 # POST /v1/chat (ver §6 sobre streaming)
│       ├── proxy-agent-run.ts            # POST /v1/agents/{agentId}/run
│       ├── proxy-executions.ts           # GET /v1/executions/{id} (+ listagem)
│       ├── proxy-approvals.ts            # GET /v1/approvals, GET /v1/approvals/{id}
│       ├── proxy-approval-decide.ts      # POST /v1/approvals/{id}/approve | /reject
│       ├── proxy-admin.ts                # GET/POST providers, models, model-routes, tools, prompts, agents
│       ├── proxy-health.ts               # GET /v1/health
│       ├── mint-stream-token.ts          # token efêmero de streaming (ver §6)
│       ├── sync-approval-notifications.ts# cronTriggerSettings — só se objeto opcional existir
│       ├── post-install.ts               # registra workspace no gateway, valida conectividade
│       └── pre-install.ts
```

Regras herdadas dos exemplos reais (`packages/twenty-apps/examples/postcard/CLAUDE.md`): todo `universalIdentifier` é UUID v4 estável; todo objeto visível tem view índice; toda view principal tem navigation menu item; front components responsivos à altura/largura fixa do widget.

## 4. [PROPOSTO] Front components

API real: `defineFrontComponent` (`packages/twenty-sdk/src/sdk/define/front-component/define-front-component.ts`). Regra de comunicação (canon): **front component → logic function do app → o2d-ai-gateway**. O front component não possui segredos; a logic function roda no servidor, lê `O2D_GATEWAY_SERVICE_SECRET` (server variable `isSecret`), assina o JWT de serviço com o `actor` = usuário Twenty e chama o gateway (doc 14 §2).

| Componente | Montagem | Conteúdo | APIs do SDK usadas (reais) |
|---|---|---|---|
| `AiChatPanel` | side panel (via `openSidePanelPage`) e widget de page layout | Chat contextual com streaming; contexto = registro aberto (`useRecordId`) enviado como `{objectName, recordId}` para o Context Builder do gateway; o gateway busca os dados via tools READ com as permissões do usuário — o front **não** envia dados do registro | `useRecordId`, `useUserId`, `useColorScheme`, logic functions `proxy-chat`/`mint-stream-token`, `enqueueSnackbar` |
| `AiActionsMenu` | side panel/headless via command menu | Lista as ações de IA disponíveis para o objeto do registro atual (catálogo filtrado retornado pelo gateway por agente+usuário+workspace) | `useRecordId`, `useSelectedRecordIds`, `proxy-agent-run` |
| `AiApprovalsInbox` | página do hub + side panel | Fila de `AIApprovalRequest` com status `PENDING`: tool + versão, **parâmetros exatos exibidos verbatim + `paramsHash`**, risco, expiração; botões Aprovar/Rejeitar (doc 15) | `useUserId`, `proxy-approvals`, `proxy-approval-decide`, `openCommandConfirmationModal` na decisão |
| `AiExecutionsList` | página do hub | Histórico de `AIExecution` do workspace: tarefa, agente, modelo efetivo, tokens, latência, custo, status, correlationId; drill-down em tool executions | `proxy-executions` |
| `AiAdminProviders` | página do hub (só `ai-admin`) | CRUD de providers do gateway (`ai_provider`): tipo de adapter, baseUrl, `secretRef` (**nunca o segredo**), `allowsSensitiveData`, ativação por workspace | `proxy-admin` |
| `AiAdminModels` | idem | Modelos + rotas por tarefa/alias (`o2d-classification`, `o2d-extraction`, ...), cadeia de fallback, flag de externo opt-in | `proxy-admin` |
| `AiAdminPrompts` | idem | Prompt Registry `chave@semver`: estados DRAFT→TESTING→PUBLISHED→DEPRECATED→ARCHIVED, diff entre versões, test cases (doc 11) | `proxy-admin` |
| `AiAdminAgents` | idem | Agentes: systemPrompt (ref), modelRoute, `allowedTools` explícitas, `maxRiskLevel`, `approvalPolicy`, roles/workspaces permitidos (doc 10) | `proxy-admin` |
| `AiAdminTools` | idem | Tool Registry: schemas in/out, nível de risco, versão; tools FORBIDDEN **não aparecem** nem aqui como "ativáveis" — apenas em auditoria de catálogo | `proxy-admin` |
| `AiMetricsDashboard` | widget no page layout do hub | Métricas resumidas do Usage Service: execuções/dia, tokens, custo por tarefa/usuário, taxa de fallback, taxa de aprovação (doc 20) | `proxy-admin` (endpoints de usage) |
| `AiServiceStatus` | widget no page layout do hub | `GET /v1/health` agregado: gateway, worker, providers (online/offline), fila | `proxy-health` |

Todas as telas administrativas **leem e escrevem via API do gateway** — o estado vive no Postgres do gateway (doc 16); o app não guarda cópia.

## 5. [PROPOSTO] Pontos de entrada — command menu items e page layout

API real: `defineCommandMenuItem` (`packages/twenty-sdk/src/sdk/define/command-menu-items/define-command-menu-item.ts`; `CommandMenuItemConfig` com `conditionalAvailabilityExpression`). Disponibilidade condicionada por registro usa as variáveis reais de `packages/twenty-sdk/src/sdk/define/conditional-availability/conditional-availability-variables.ts` (`selectedRecords`, `numberOfSelectedRecords`, `objectMetadataItem`, `pageType`, ...). Cada comando abre o front component correspondente (`frontComponentUniversalIdentifier`) ou dispara `proxy-agent-run` com a tarefa indicada. Ações também aparecem como widgets/abas nos page layouts dos objetos (via `definePageLayout`/`definePageLayoutTab` — `packages/twenty-sdk/src/sdk/define/page-layouts/`).

| Objeto | Comando (exato) | Tarefa/agente no gateway | Risco resultante |
|---|---|---|---|
| Empresa (`company`) | **Resumir relacionamento** | `customer.summarize` (agente comercial; tools READ crm.\*, memory.search) | READ — auto |
| Empresa | **Identificar pendências** | agente comercial (tools READ: proposal.search, project.list_delays, finance.list_overdue†) | READ — auto |
| Empresa | **Preparar próxima reunião** | agente de reuniões (READ + memory.search + document.search) | READ — auto |
| Proposta (`proposal` do app `odois-proposals`) | **Extrair escopo** | `proposal.extract` → structured output `proposal-extraction@1.0.0` | READ/validação |
| Proposta | **Melhorar texto** | `proposal.write` (tool LOW_WRITE `proposal.update_draft`) | LOW_WRITE — auditado |
| Proposta | **Comparar versões** | tool LOW_WRITE `contract.compare_versions` / leitura de versões do Serviço de Propostas | READ |
| Proposta | **Gerar prévia** | tool LOW_WRITE `proposal.generate_preview` | LOW_WRITE — auditado |
| Projeto | **Resumir status** | `project.get_status` (READ) + sumarização | READ — auto |
| Projeto | **Identificar riscos** | agente de projetos (READ project.\*, list_delays) | READ — auto |
| Projeto | **Gerar relatório** | tool LOW_WRITE `project.generate_report` | LOW_WRITE — auditado |

† exige permissão financeira do usuário iniciador — o catálogo enviado ao modelo já vem filtrado (doc 05).

Qualquer sugestão de tool SENSITIVE/CRITICAL surgida durante essas conversas cai no fluxo de aprovação do doc 15 — nunca é executada direto pela UI.

## 6. [PROPOSTO] Logic functions — proxies finos e autenticados

API real: `defineLogicFunction` (`packages/twenty-sdk/src/sdk/define/logic-functions/define-logic-function.ts`), triggers em `packages/twenty-shared/src/application/logicFunctionManifestType.ts`. Princípios (idênticos ao app de propostas, doc irmão `proposal-module/10` §9):

1. **Proxies finos.** Validam payload → assinam JWT de serviço curto (segredo em `serverVariables` `isSecret`; nunca chega ao browser — o front só vê variáveis via `getApplicationVariable`, que não expõe secrets) → propagam `actor` = usuário Twenty (`userId`, `workspaceMemberId`, roles) e `X-O2d-Workspace-Id` → chamam o endpoint `/v1/*` do gateway (doc 17) → devolvem a resposta. `Idempotency-Key` e `X-Correlation-Id` em toda ação.
2. **Nenhuma regra de negócio no app.** Validação de tool call, risco, aprovação, roteamento de modelo: tudo no gateway. Contornar o app não abre nenhum atalho.
3. **NUNCA credencial privilegiada no browser.** O front component jamais porta o segredo de serviço. Para streaming (abaixo), usa-se token efêmero escopado ao usuário, não a credencial de serviço.
4. **Streaming SSE do chat** — `POST /v1/chat` é SSE. A invocação de logic function via route trigger (`route-trigger.controller.ts`) responde requisição/resposta, sem streaming garantido até o sandbox. Estratégia proposta, a confirmar em spike (§10):
   - `mint-stream-token.ts` devolve um token efêmero (≤60 s, escopo `chat:stream`, um único uso) assinado pelo gateway;
   - o `AiChatPanel` abre `fetch`/`EventSource` **direto no gateway** com esse token — permitido porque o token carrega apenas a identidade e permissões do próprio usuário (não é credencial privilegiada);
   - fallback sem SSE no sandbox: polling incremental de `GET /v1/executions/{id}` + `updateProgress`.
5. `post-install.ts`/`pre-install.ts` (padrão real `definePostInstallLogicFunction`/`definePreInstallLogicFunction`, exemplo `packages/twenty-apps/examples/postcard/src/logic-functions/`): registram o workspace no gateway e validam conectividade/versão de contratos (`o2d-ai-contracts`).

## 7. [PROPOSTO] Objetos do app — mínimo necessário

**Recomendação: NENHUM espelho de dados do gateway.** A fonte da verdade de providers, modelos, prompts, agentes, tools, execuções, aprovações, conversas e conhecimento é o Postgres do gateway (doc 16); a UI lê via API. Duplicar no Twenty criaria dessincronização, superfície de vazamento e migrações desnecessárias.

Opcional (decisão adiada — doc 24): `ai-approval-notification.object.ts` — objeto **leve** apenas para notificação/timeline: `approvalRequestId` (TEXT, ref ao gateway), `toolName`, `risk` (SELECT), `status` (SELECT, espelho), `expiresAt` (DATE_TIME), `syncedAt` (DATE_TIME), relação opcional com o registro de origem. Mantido por `sync-approval-notifications.ts` (cron) ou por webhook do gateway; **nunca** é a fonte de decisão — aprovar/rejeitar sempre passa por `POST /v1/approvals/{id}/approve|reject` no gateway.

## 8. [PROPOSTO] Roles do app

API real: `defineRole`/`defineApplicationRole` (`packages/twenty-sdk/src/sdk/define/roles/`); `PermissionFlag` de `twenty-shared/constants` (o enum real inclui `AI`). As roles do Twenty são **propagadas no actor** e re-verificadas pelo Authorization Service do gateway (doc 14 §3) — o Twenty nunca é a única barreira.

| Role do app | No Twenty | No gateway (re-verificado) |
|---|---|---|
| `ai-user` | acesso ao `AiChatPanel`/`AiActionsMenu`/`AiExecutionsList` (as próprias execuções) | pode conversar e disparar tools READ/LOW_WRITE que suas permissões de CRM permitirem (on-behalf-of) |
| `ai-approver` | acesso ao `AiApprovalsInbox` | pode decidir `AIApprovalRequest` **se também** tiver a permissão da tool subjacente (doc 15 §4) |
| `ai-admin` | acesso às telas `AiAdmin*` e `AiMetricsDashboard` | CRUD de providers/modelos/prompts/agentes/tools; nunca lê segredos (só `secretRef`) |
| `hub-function` | role técnica das logic functions (mínimo necessário; update no objeto opcional §7) | — |

`definePermissionFlag` (`packages/twenty-sdk/src/sdk/define/permission-flags/`) somente se as telas do hub precisarem de um flag custom de navegação; as permissões de negócio de IA **não** são modeladas como permission flags do Twenty — o enforcement canônico vive no gateway.

## 9. [PROPOSTO] Menor número possível de alterações no core: ZERO

O app usa exclusivamente APIs públicas (`twenty-sdk/define`, `twenty-sdk/front-component`, `twenty-client-sdk`). Nenhum import de código interno de `twenty-server`/`twenty-front`, nenhuma migration no Postgres do Twenty (pgvector vive no Postgres do gateway — decisão canônica 5), nenhum arquivo de `packages/twenty-docker/` tocado (doc 21).

### 9.1 Fork do Twenty — avaliado e rejeitado

| Critério | Análise |
|---|---|
| Custo de rebase | O Twenty lança releases contínuas com refatorações profundas (ex.: migração `twenty-cli` → `twenty-sdk` já ocorrida). Um fork obrigaria rebase e re-teste do diff proprietário a cada release, com conflitos recorrentes em `engine/metadata-modules/ai/` — justamente a área mais ativa do upstream. |
| Licença AGPL v3 | O Twenty é AGPL (+ arquivos `@license Enterprise` — ver `LICENSE` na raiz). Um fork **operado como serviço de rede** obriga a disponibilizar o código-fonte modificado a todos os usuários da rede (§13 da AGPL) — incompatível com o caráter proprietário da o2d-ai-platform. Mantendo o core intocado e a inteligência no gateway externo (processo e repositório separados), a fronteira fica clara. Revisão jurídica formal antes do go-live permanece como questão aberta (doc 24), como no módulo de propostas. |
| Necessidade real | A plataforma de apps cobre todas as necessidades do hub (UI, ações, permissões, proxies autenticados). Nenhum requisito do enunciado exige tocar o core. |

### 9.2 Tabela hipotética — "se um dia for necessário"

Registro preventivo; **nenhuma linha está aprovada** (qualquer entrada aqui exige decisão explícita — doc 24):

| Arquivo / ponto de integração (real) | Alteração hipotética | Justificativa hipotética | Risco | Impacto em updates | Alternativa via App | Implicação de licença |
|---|---|---|---|---|---|---|
| `packages/twenty-front-component-renderer/` | Permitir `EventSource`/fetch streaming no sandbox | Streaming SSE nativo no `AiChatPanel` | Médio (superfície de segurança do sandbox) | Alto — código do core diverge a cada release | Token efêmero + fetch direto ao gateway (§6.4) ou polling | AGPL: modificação distribuída em rede ⇒ obrigação de fonte |
| `packages/twenty-server/src/engine/metadata-modules/route-trigger/route-trigger.controller.ts` | Suporte a resposta chunked/SSE em route triggers | Proxy de streaming sem token extra | Médio | Alto | Idem acima | Idem |
| `packages/twenty-front/src/modules/ai/` (side panel ask-ai) | Substituir o chat nativo pelo chat o2d | UX unificada | Alto (regra 17 violada na direção inversa: acoplamento ao front do core) | Muito alto | Side panel próprio via `openSidePanelPage` — já é o plano | Idem |
| `packages/twenty-server/src/engine/core-modules/message-queue/message-queue.constants.ts` | Fila dedicada o2d no BullMQ do Twenty | Jobs do hub no worker do Twenty | Baixo tecnicamente, alto arquiteturalmente | Médio | Worker próprio do gateway (canon) | Idem |
| Notificações in-app persistentes (inexistentes no core — só snackbar/e-mail) | Criar centro de notificações | Avisar aprovações pendentes | Alto | Alto | Objeto opcional `aiApprovalNotification` (§7) + e-mail enviado pelo gateway | Idem |

## 10. [PROPOSTO] Integração com módulos proprietários

Os módulos proprietários (ex.: **Serviço de Propostas**, `docs/specs/proposal-module/`) **chamam o gateway diretamente** com token S2S próprio (doc 14 §2; auth tipo (b) do doc 17) — o hub app não fica no caminho. O hub apenas **exibe**: execuções, aprovações e métricas dessas chamadas aparecem em `AiExecutionsList`/`AiApprovalsInbox`/`AiMetricsDashboard` porque tudo é registrado no Postgres do gateway. Nota de compatibilidade: o doc `proposal-module/08-llm-spec.md` previa chamada direta ao Vercel AI SDK no worker do serviço; com a plataforma, essa chamada é substituída por chamada ao gateway (tarefas `proposal.extract`/`proposal.write`).

## 11. Limitações reais e riscos

| # | Risco / limitação | Situação | Mitigação |
|---|---|---|---|
| 1 | **Streaming SSE dentro do sandbox de front component** (`packages/twenty-front-component-renderer/` executa o componente isolado; comportamento de `fetch` streaming/`EventSource` até um host externo não confirmado) | **Questão aberta — verificar em spike** (Fase 2, doc 23) | Token efêmero + conexão direta ao gateway; fallback: polling incremental + `updateProgress` |
| 2 | Evolução do SDK de apps (plataforma recente; `twenty-cli` já foi depreciado em favor de `twenty-sdk`) — breaking changes possíveis | Risco de manutenção | Fixar versão do `twenty-sdk`; CI do app com testes de schema no molde de `packages/twenty-apps/examples/postcard/src/__tests__/schema.integration-test.ts`; smoke test pós-upgrade do Twenty |
| 3 | Front components responsivos à altura/largura fixa do widget, sem scroll próprio (pitfall em `packages/twenty-apps/examples/postcard/CLAUDE.md`) | Restrição de design | Layout adaptativo nos 11 componentes; listas longas paginadas |
| 4 | Latência UI → logic function → gateway | Inerente aos proxies | Streaming/polling incremental no chat; ações longas assíncronas com `GET /v1/executions/{id}` |
| 5 | Ausência de notificação in-app persistente no Twenty | Limitação atual do core | Objeto opcional §7 + e-mail disparado pelo Approval Service |
| 6 | Telas admin dependem da disponibilidade do gateway | Por design (zero espelho) | `AiServiceStatus` com estado degradado explícito; nada quebra no Twenty se o gateway cair |
