# 10 — App óDois: Twenty App proprietário (`odois-proposals`)

> Módulo proprietário óDois — arquitetura **proposta** (não implementada), construída sobre a plataforma de apps **real** do Twenty.
> Convenção deste documento: seções marcadas **[ATUAL]** descrevem o que existe no repositório (com caminhos reais); seções **[PROPOSTO]** descrevem o app a ser construído.

## 1. [ATUAL] Plataforma de apps do Twenty

O Twenty possui uma plataforma de apps completa e funcional no repositório:

| Componente | O que é | Caminho real |
|---|---|---|
| SDK de definição | `defineApplication`, `defineObject`, `defineField`, `defineLogicFunction`, `defineFrontComponent`, `defineCommandMenuItem`, `defineAgent`, `defineRole`, `defineApplicationRole`, `defineView`, `definePageLayout`, `defineNavigationMenuItem`, `defineConnectionProvider`, `definePermissionFlag`, `defineSkill` | `packages/twenty-sdk/src/sdk/define/index.ts` |
| Manifest por convenção de arquivos | O manifest do app é gerado a partir da estrutura de diretórios (`application.config.ts`, `objects/*.object.ts`, `fields/*.field.ts`, `logic-functions/*.ts`, `components/*.front-component.tsx`, `roles/*.role.ts`, `views/*.view.ts`, `page-layouts/*.page-layout.ts`, `navigation-menu-items/*.navigation-menu-item.ts`, `agents/*.agent.ts`) | Tipos em `packages/twenty-shared/src/application/manifestType.ts` (+ `*ManifestType.ts` por entidade) |
| Exemplos reais | App de exemplo com objeto, campos em objeto padrão, view, page layout, navigation item, roles, front components, agente; apps públicos com command menu items | `packages/twenty-apps/examples/postcard/`, `packages/twenty-apps/public/twenty-slack/` |
| CLI | `twenty dev`, `dev:build`, `dev:add`, `app:publish [--private]`, `app:install`, `docker:*`, `remote:*` | `packages/twenty-sdk/src/cli/commands/`; scaffold em `packages/create-twenty-app/src/create-app.command.ts` |
| Sandbox de front components | Renderizador isolado dos componentes de app no frontend | `packages/twenty-front-component-renderer/`; montagem em side panel em `packages/twenty-front/src/modules/side-panel/pages/front-component/` |
| APIs de host do front component | Hooks e funções expostos ao componente sandboxed | `packages/twenty-sdk/src/sdk/front-component/` — `hooks/` (`useRecordId`, `useSelectedRecordIds`, `useUserId`, `useColorScheme`, `useFrontComponentId`, `useFrontComponentExecutionContext`), `functions/` (`openCommandConfirmationModal`, `openSidePanelPage`, `enqueueSnackbar`, `navigate`, `closeSidePanel`, `copyToClipboard`, `getApplicationVariable`, `updateProgress`, `unmountFrontComponent`) |
| Client SDK tipado | `CoreApiClient` (GraphQL), `MetadataApiClient`, `RestApiClient` — usados por logic functions e front components | `packages/twenty-client-sdk/` |
| Backend de apps | Manifest, sync, install, marketplace, OAuth, tokens `APPLICATION_ACCESS` | `packages/twenty-server/src/engine/core-modules/application/` |
| Logic functions no servidor | Drivers LOCAL/LAMBDA/DISABLED; triggers cron, database-event, route, tool, workflow-action | `packages/twenty-server/src/engine/metadata-modules/logic-function/`, `packages/twenty-server/src/engine/core-modules/logic-function/logic-function-drivers/logic-function-driver.factory.ts`; tipos de trigger em `packages/twenty-shared/src/application/logicFunctionManifestType.ts` (`cronTriggerSettings`, `databaseEventTriggerSettings`, `httpRouteTriggerSettings`, `serverRouteTriggerSettings`, `toolTriggerSettings`, `workflowActionTriggerSettings`) |
| Docs de apps | Getting started, data, logic, layout, config, operations | `packages/twenty-docs/developers/extend/apps/**` |

Tudo o que o App óDois precisa já existe como API pública da plataforma. **Nenhuma modificação do core do Twenty é necessária** (decisão canônica — ver `02`/`04`).

## 2. [PROPOSTO] Estrutura do app `odois-proposals`

Segue a convenção real dos exemplos (`packages/twenty-apps/examples/postcard/src/`):

```
odois-proposals/
├── package.json                # dep: twenty-sdk
├── src/
│   ├── application.config.ts   # defineApplication({ universalIdentifier, label: 'óDois Propostas', ... })
│   ├── constants/
│   │   └── universal-identifiers.ts   # UUIDs v4 estáveis de todas as entidades
│   ├── objects/
│   │   ├── proposal.object.ts
│   │   ├── proposal-item.object.ts
│   │   ├── service-catalog-item.object.ts
│   │   └── proposal-template.object.ts
│   ├── fields/                 # extensões de objetos padrão + relações entre objetos do app
│   │   ├── proposals-on-company.field.ts
│   │   ├── proposals-on-person.field.ts
│   │   ├── proposals-on-opportunity.field.ts
│   │   ├── owner-on-proposal.field.ts          # relação proposal → workspaceMember
│   │   └── items-on-proposal.field.ts          # proposal 1—N proposalItem
│   ├── roles/
│   │   ├── proposal-attendant.role.ts
│   │   ├── proposal-owner.role.ts
│   │   ├── proposal-reviewer.role.ts
│   │   ├── proposal-approver.role.ts
│   │   ├── proposal-admin.role.ts
│   │   └── integration-function.role.ts        # role das logic functions do app
│   ├── views/
│   │   ├── proposals-kanban-by-status.view.ts
│   │   ├── all-proposals.view.ts
│   │   └── catalog-items.view.ts
│   ├── page-layouts/
│   │   └── proposal-record-page.page-layout.ts
│   ├── navigation-menu-items/
│   │   └── proposals.navigation-menu-item.ts
│   ├── components/
│   │   ├── proposal-review-panel.front-component.tsx
│   │   ├── proposal-version-diff.front-component.tsx
│   │   ├── proposal-send-confirmation.front-component.tsx
│   │   └── proposal-timeline.front-component.tsx
│   ├── command-menu-items/
│   │   ├── request-approval.command-menu-item.ts
│   │   ├── approve-proposal.command-menu-item.ts
│   │   ├── request-changes.command-menu-item.ts
│   │   └── send-proposal.command-menu-item.ts
│   ├── logic-functions/
│   │   ├── proxy-request-approval.ts
│   │   ├── proxy-approve.ts
│   │   ├── proxy-request-changes.ts
│   │   ├── proxy-reject.ts
│   │   ├── proxy-send.ts
│   │   ├── proxy-generate-preview.ts
│   │   ├── proxy-get-proposal.ts
│   │   ├── proxy-get-versions.ts
│   │   ├── proxy-get-events.ts
│   │   ├── post-install.ts                     # registra webhook/config inicial
│   │   └── pre-install.ts
│   └── agents/                                  # opcional (Fase 4; não no MVP)
│       └── proposal-assistant.agent.ts
```

Regras herdadas dos exemplos reais: todo `universalIdentifier` é UUID v4 estável (nunca regenerado entre versões); todo objeto visível tem view índice; toda view principal tem navigation menu item (pitfalls documentados em `packages/twenty-apps/examples/postcard/CLAUDE.md`).

## 3. [PROPOSTO] Objetos do app

Referência de dados: `05-data-model.md`. Padrão de código: `packages/twenty-apps/examples/postcard/src/objects/post-card.object.ts` (`defineObject` + `fields: [...]` com `FieldType` de `twenty-sdk/define`; `FieldType` real em `packages/twenty-sdk/src/sdk/define/fields/field-type.ts`, 25 tipos espelhando `packages/twenty-shared/src/types/FieldMetadataType.ts`).

### 3.1 `proposal`

| Campo | FieldType | Observações |
|---|---|---|
| `number` | `TEXT` | identificador de negócio (ex.: `PROP-2026-0042`); gerado pelo Serviço de Propostas |
| `title` | `TEXT` | labelIdentifier do objeto |
| `status` | `SELECT` | **todos os 20 estados canônicos** do doc 07: `REQUEST_RECEIVED`, `COLLECTING_MESSAGES`, `INTERPRETING`, `NEEDS_INFORMATION`, `DRAFT_GENERATED`, `PREVIEW_GENERATING`, `AWAITING_INTERNAL_REVIEW`, `CHANGES_REQUESTED`, `PENDING_APPROVAL`, `APPROVED`, `FINAL_DOCUMENT_GENERATING`, `READY_TO_SEND`, `SENDING`, `SENT`, `VIEWED`, `ACCEPTED`, `REJECTED`, `CANCELED`, `EXPIRED`, `PROCESSING_ERROR`, `SEND_ERROR`. Somente leitura para usuários (ver §3.5) |
| `origin` | `SELECT` | `WHATSAPP` \| `MANUAL` \| `MCP` |
| `description`, `scope`, `deliveryTime`, `paymentTerms` | `TEXT` / `RICH_TEXT_V2` | conteúdo comercial |
| `subtotal`, `discount`, `total` | `CURRENCY` | composite real do Twenty: `amountMicros` (NUMERIC) + `currencyCode` (TEXT) — `packages/twenty-shared/src/types/composite-types/currency.composite-type.ts`; mesmo tipo do `amount` de `opportunity` (`packages/twenty-server/src/modules/opportunity/standard-objects/opportunity.workspace-entity.ts`) |
| `validUntil` | `DATE_TIME` | validade da proposta |
| `confidenceScore` | `NUMBER` | score da interpretação LLM |
| `recipientPhone` | `PHONES` | destinatário WhatsApp (E.164) |
| `recipientValidatedAt`, `sentAt`, `viewedAt`, `acceptedAt` | `DATE_TIME` | marcos do ciclo |
| `currentVersionId`, `approvedVersionId`, `previewDocumentId`, `finalDocumentId` | `TEXT` | **referências** a registros do banco interno do Serviço de Propostas (fonte de verdade técnica — decisão 5 do canon); o Twenty não duplica snapshots |
| `approvedSnapshotHash`, `finalDocumentHash` | `TEXT` | hashes SHA-256; somente leitura para usuários |
| `previewUrl` | `LINKS` | URL assinada de curta duração para a prévia |
| `company` | `RELATION` (MANY_TO_ONE) | → objeto padrão `company` |
| `contact` | `RELATION` (MANY_TO_ONE) | → objeto padrão `person` |
| `opportunity` | `RELATION` (MANY_TO_ONE) | → objeto padrão `opportunity` |
| `owner` | `RELATION` (MANY_TO_ONE) | → objeto padrão `workspaceMember` |
| `items` | `RELATION` (ONE_TO_MANY) | → `proposalItem` |

### 3.2 `proposalItem`

`name` (TEXT), `description` (TEXT), `quantity` (NUMBER), `unitPrice` (CURRENCY), `discount` (CURRENCY), `total` (CURRENCY), `requiresApproval` (BOOLEAN — flag de desconto/preço fora de política, doc 09 §2.2 nota 1), `position` (POSITION), relações `proposal` (MANY_TO_ONE) e `catalogItem` (MANY_TO_ONE → `serviceCatalogItem`).

### 3.3 `serviceCatalogItem`

`name`, `code` (TEXT, unique), `description`, `basePrice` (CURRENCY), `minPrice` (CURRENCY), `minMarginPercent` (NUMBER), `unit` (SELECT), `isActive` (BOOLEAN). Preços saem **sempre** daqui + regras determinísticas — nunca da LLM (doc 08).

### 3.4 `proposalTemplate`

`name`, `description`, `version` (NUMBER), `isDefault` (BOOLEAN), `storageKey` (TEXT — o arquivo do template vive no storage do Serviço de Propostas; o objeto guarda metadados/referência).

### 3.5 `status` somente leitura para usuários

Mecanismo real: `fieldPermission` por role (`packages/twenty-server/src/engine/metadata-modules/object-permission/field-permission/field-permission.entity.ts`, com `canUpdateFieldValue`). As roles do app (§5) marcam `status`, `approvedSnapshotHash`, `finalDocumentHash`, `approvedVersionId`, `currentVersionId`, `finalDocumentId` como não editáveis para **todas** as roles humanas. Só a **integração técnica** (API key do Serviço de Propostas com role dedicada — `packages/twenty-server/src/engine/core-modules/api-key/`) escreve esses campos, e sempre como reflexo de uma transição validada pela máquina de estados do serviço (doc 07 §6). A UI nunca edita `status`; ela chama logic functions (§9).

## 4. [PROPOSTO] Extensão de objetos padrão

Mecanismo real: arquivo `fields/*.field.ts` com `defineField` apontando `objectUniversalIdentifier` para `STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS` — exatamente como `packages/twenty-apps/examples/postcard/src/fields/post-cards-on-person.field.ts` adiciona a relação `postCards` em `person`. Exports reais: `STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS` e `RelationType` em `packages/twenty-sdk/src/sdk/define/index.ts`.

| Arquivo | Objeto padrão | Campo adicionado |
|---|---|---|
| `fields/proposals-on-company.field.ts` | `company` | `proposals` — `RELATION` `ONE_TO_MANY` → `proposal.company` |
| `fields/proposals-on-person.field.ts` | `person` | `proposals` — `RELATION` `ONE_TO_MANY` → `proposal.contact` |
| `fields/proposals-on-opportunity.field.ts` | `opportunity` | `proposals` — `RELATION` `ONE_TO_MANY` → `proposal.opportunity` |

Nenhum campo de objeto padrão é modificado ou removido — apenas adicionados (compatível com upgrades do Twenty).

## 5. [PROPOSTO] Roles do app

API real: `defineApplicationRole` / `defineRole` (`packages/twenty-sdk/src/sdk/define/roles/define-application-role.ts` e `define-role.ts`; exemplo: `packages/twenty-apps/examples/postcard/src/roles/default-function.role.ts`). Suporta `objectPermissions`, `fieldPermissions`, `permissionFlags` e predicados row-level (`RowLevelPermissionPredicateManifest` — RLS real em `packages/twenty-server/src/engine/metadata-modules/role/row-level-permission-predicate/`).

Mapeamento da matriz do doc 09 §2.2 (permissões **no Twenty** — as permissões de **ação** são sempre re-verificadas no Serviço de Propostas, que é o gate real):

| Role do app | objectPermissions (objetos do app) | fieldPermissions | Observações |
|---|---|---|---|
| `proposal-attendant` | read em tudo; update parcial em `proposal` (campos não comerciais) | `status`/hashes read-only; campos comerciais (`subtotal`, `discount`, `total`, `unitPrice`) read-only | acompanha e completa dados |
| `proposal-owner` | read/update em `proposal`/`proposalItem`; create em `proposal` | `status`/hashes read-only | dono do ciclo; edita rascunho, solicita aprovação, autoriza envio (via serviço) |
| `proposal-reviewer` | read em tudo | `status`/hashes read-only; sem update de conteúdo | pede ajustes/rejeita via ações (serviço), não edita |
| `proposal-approver` | read em tudo | `status`/hashes read-only | **aprovar não é permissão de objeto**: é ação no serviço, que exige esta role + identidade humana |
| `proposal-admin` | full nos objetos do app, incl. `serviceCatalogItem` e `proposalTemplate` | `status`/hashes read-only mesmo para admin | configura catálogo/templates/margens |
| `integration-function` (role das logic functions) e role da API key do serviço | update em `proposal` incluindo `status`/hashes | sem restrição de campo | únicas identidades que escrevem `status` — e apenas refletindo o serviço |

`permissionFlags` custom via `definePermissionFlag` (`packages/twenty-sdk/src/sdk/define/permission-flags/`) apenas se necessário para telas de configuração do app; as permissões de negócio (aprovar/enviar) **não** são modeladas como permission flags do Twenty, pois o enforcement canônico vive no serviço (doc 09 §7, ameaça "usuário sem permissão aprovando").

## 6. [PROPOSTO] Views, page layout e navegação

APIs reais: `defineView` (`ViewType`, `ViewKey` — `packages/twenty-sdk/src/sdk/define/views/`), `definePageLayout`/`definePageLayoutTab` (`packages/twenty-sdk/src/sdk/define/page-layouts/`), `defineNavigationMenuItem` (exemplo: `packages/twenty-apps/examples/postcard/src/navigation-menu-items/post-cards.navigation-menu-item.ts`).

- `proposals-kanban-by-status.view.ts` — `ViewType.KANBAN` agrupada pelo SELECT `status` (mesmo padrão do kanban de `opportunity.stage`). Colunas na ordem do fluxo do doc 07.
- `all-proposals.view.ts` — tabela índice (`ViewKey.INDEX`) com `number`, `title`, `status`, `company`, `total`, `validUntil`, `owner`.
- `catalog-items.view.ts` — tabela do catálogo.
- `proposal-record-page.page-layout.ts` — layout da página de registro `proposal` com abas: **Detalhes** (campos), **Itens** (relação `items`), **Revisão** (widget front component `ProposalReviewPanel`), **Versões** (widget `ProposalVersionDiff`), **Linha do tempo** (widget `ProposalTimeline`). Exemplo real de page layout com widget de front component: `packages/twenty-apps/examples/postcard/src/page-layouts/post-card-record-page.page-layout.ts`.
- `proposals.navigation-menu-item.ts` — item "Propostas" na sidebar apontando para a view índice.

## 7. [PROPOSTO] Front components

API real: `defineFrontComponent` (`packages/twenty-sdk/src/sdk/define/front-component/define-front-component.ts`); execução no sandbox `packages/twenty-front-component-renderer/`; montagem em side panel (`packages/twenty-front/src/modules/side-panel/pages/front-component/`), como widget de page layout ou headless via command menu.

Regra de comunicação (decisão 3 do canon): **front component → logic function do app → Serviço de Propostas**. O front component **nunca** fala com o serviço portando credencial privilegiada — ele não possui segredos; a logic function roda no servidor, obtém o token de serviço e propaga o `actor`.

| Componente | Montagem | Conteúdo | APIs do SDK usadas (reais) |
|---|---|---|---|
| `ProposalReviewPanel` | aba "Revisão" do page layout + side panel | dados estruturados da proposta + viewer da prévia (via `previewUrl` assinada) + botões **Solicitar aprovação**, **Pedir ajustes**, **Rejeitar** | `useRecordId`, `useUserId` (`.../front-component/hooks/`), chamadas às logic functions, `enqueueSnackbar` para feedback |
| `ProposalVersionDiff` | aba "Versões" | lista de `ProposalVersion` (via `proxy-get-versions`) e comparação lado a lado de duas versões (diff de campos/itens/totais) | `useRecordId`, logic function de leitura |
| `ProposalSendConfirmation` | modal aberto pelo command menu "Enviar proposta" | exibe **destinatário (telefone validado), número da versão aprovada e `finalDocumentHash`** antes de confirmar — materializa a exigência do doc 07 §3.12 ("exibição do destinatário e do documento exato") | `openCommandConfirmationModal` (`.../front-component/functions/openCommandConfirmationModal.ts`) para a confirmação; em seguida `proxy-send` |
| `ProposalTimeline` | aba "Linha do tempo" + side panel | eventos `proposal_event` do serviço (via `proxy-get-events`): recepção, interpretação, versões, aprovações (com ator), envio, visualização | `useRecordId`, `useColorScheme` |

Validações exibidas nos componentes (ex.: botão de enviar desabilitado se `status != READY_TO_SEND`) são **apenas UX** — a barreira real é o gate `canSendProposal` no backend do serviço (doc 09 §1.2).

## 8. [PROPOSTO] Command menu items

API real: `defineCommandMenuItem` — exemplo: `packages/twenty-apps/public/twenty-slack/src/command-menu-items/send-slack-message.command-menu-item.ts` (`label`, `shortLabel`, `icon`, `isPinned`, `availabilityType`, `frontComponentUniversalIdentifier`). Disponibilidade condicionada por registro selecionado usa as variáveis de disponibilidade condicional reais (`selectedRecords`, `numberOfSelectedRecords`, `objectMetadataItem` etc. — `packages/twenty-sdk/src/sdk/define/conditional-availability/conditional-availability-variables.ts`).

| Comando | Disponível quando (UX) | Fluxo |
|---|---|---|
| "Solicitar aprovação" | registro `proposal` com `status = AWAITING_INTERNAL_REVIEW` | abre confirmação → `proxy-request-approval` → `POST /proposals/{id}/request-approval` |
| "Aprovar" | `status = PENDING_APPROVAL` | abre front component de confirmação exibindo versão + hash → `proxy-approve` → `POST /proposals/{id}/approve {versionId, snapshotHash}` — o serviço valida a role de aprovador do `actor` |
| "Pedir ajustes" | estados de revisão/aprovação | modal de comentário → `proxy-request-changes` |
| "Enviar proposta" | `status = READY_TO_SEND` | abre `ProposalSendConfirmation` (destinatário + versão + hash) → `proxy-send` → `POST /proposals/{id}/send` (gate reavaliado no serviço) |

Todos os comandos chamam logic functions; nenhum escreve em objetos do Twenty diretamente.

## 9. [PROPOSTO] Logic functions — proxies finos e autenticados

API real: `defineLogicFunction` (`packages/twenty-sdk/src/sdk/define/logic-functions/`); triggers reais em `packages/twenty-shared/src/application/logicFunctionManifestType.ts`: `cronTriggerSettings`, `databaseEventTriggerSettings` (`eventName`, `updatedFields`), `httpRouteTriggerSettings` (`path`, `httpMethod`, `isAuthRequired`), `serverRouteTriggerSettings`, `toolTriggerSettings`, `workflowActionTriggerSettings`. Rotas autenticadas servidas por `packages/twenty-server/src/engine/metadata-modules/route-trigger/route-trigger.controller.ts`.

Princípios:

1. **Proxies finos**: cada função valida o payload, monta o token de serviço (JWT curto assinado com segredo dedicado — doc 09 §3) com `actor` = usuário Twenty que disparou a ação, chama o endpoint correspondente do Serviço de Propostas (doc 06) e devolve a resposta. Segredos via variáveis de aplicação (`getApplicationVariable` no front nunca expõe segredos; segredos ficam só no lado servidor da logic function).
2. **Nenhuma regra de negócio de aprovação no app.** A máquina de estados, o gate `canSendProposal`, a validação de versão/hash e a checagem de papel de aprovador vivem exclusivamente no Serviço de Propostas (docs 07 e 09). Se o app for contornado (chamada direta à API), nada muda: o serviço é a barreira.
3. **O app NUNCA edita `status`.** Toda transição é uma chamada a endpoint do serviço; o serviço, após transicionar, reflete o novo status no objeto `proposal` via API key de integração (client tipado `packages/twenty-client-sdk/`).
4. **Idempotência**: cada proxy de ação envia `Idempotency-Key` (doc 06).
5. `post-install.ts` / `pre-install.ts` (padrão real: `definePostInstallLogicFunction`/`definePreInstallLogicFunction`, exemplo em `packages/twenty-apps/examples/postcard/src/logic-functions/`) registram a configuração inicial (URL do serviço, criação do webhook de saída do Twenty para o serviço, se usado).

| Logic function | Trigger | Endpoint do serviço (doc 06) |
|---|---|---|
| `proxy-get-proposal` | invocação pelo front component | `GET /proposals/{id}` |
| `proxy-get-versions` / `proxy-get-events` | idem | `GET /proposals/{id}/versions` · `/events` |
| `proxy-generate-preview` | idem | `POST /proposals/{id}/generate-preview` |
| `proxy-request-changes` | idem | `POST /proposals/{id}/request-changes` |
| `proxy-request-approval` | idem | `POST /proposals/{id}/request-approval` |
| `proxy-approve` | idem | `POST /proposals/{id}/approve` |
| `proxy-reject` | idem | `POST /proposals/{id}/reject` |
| `proxy-send` | idem | `POST /proposals/{id}/send` |

Opcional (Fase 4): expor um subconjunto de leitura como `toolTriggerSettings` para agentes Twenty/MCP nativo — trade-offs no doc `12-mcp-spec.md` §3.

## 10. [PROPOSTO] Instalação, distribuição e compatibilidade

- **Distribuição privada**: `twenty app:publish --private` (CLI real em `packages/twenty-sdk/src/cli/commands/`) — o app não vai ao marketplace público; instalação via `twenty app:install` no workspace da óDois. Desenvolvimento com `twenty dev` (sync contínuo do manifest).
- **Upgrade**: republicar o app re-sincroniza o manifest (backend de sync em `packages/twenty-server/src/engine/core-modules/application/`). `universalIdentifier`s estáveis garantem upgrade idempotente sem duplicar entidades.
- **Compatibilidade com atualizações do Twenty**: o app usa **apenas** APIs públicas do SDK (`twenty-sdk/define`, `twenty-sdk` front-component, `twenty-client-sdk`) e referências a objetos padrão via `STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS`. Nenhum import de código interno de `twenty-server`/`twenty-front`.
- **AGPL**: o Twenty é AGPL v3 (+ arquivos `@license Enterprise` — ver `LICENSE`). O App óDois é um artefato declarativo instalado via manifest e as regras de negócio vivem no Serviço de Propostas (processo e repositório separados); o core não é modificado, evitando a obrigação de disponibilizar o código proprietário a usuários de rede (decisão 6 do canon). **Questão aberta**: revisão jurídica formal da fronteira app/serviço antes do go-live.

## 11. Limitações reais e riscos

| # | Risco / limitação | Situação | Mitigação |
|---|---|---|---|
| 1 | **Visualização de PDF dentro do sandbox de front component** — o renderer (`packages/twenty-front-component-renderer/`) executa o componente isolado; embutir um viewer de PDF (iframe para URL assinada externa) pode esbarrar em CSP/sandbox | **Questão aberta — verificar em spike** | Fallback: botão "Abrir prévia" (nova aba com URL assinada curta) + thumbnail PNG gerado pelo Serviço de Documentos e exibido como imagem |
| 2 | Front components devem ser responsivos à altura/largura fixa do widget, sem scroll próprio (pitfall documentado em `packages/twenty-apps/examples/postcard/CLAUDE.md`) | Restrição de design | Layout adaptativo nos 4 componentes |
| 3 | Latência UI → logic function → serviço nas ações de revisão | Inerente ao design (proxies) | `updateProgress`/snackbars; endpoints do serviço síncronos e rápidos, trabalho pesado em fila |
| 4 | `fieldPermission` protege `status` contra edição por usuários, mas a integridade real depende do serviço | Por design | O serviço é a única autoridade de transição (doc 07 §1); testes obrigatórios (doc 13) |
| 5 | Evolução do SDK de apps (plataforma recente; `twenty-cli` já foi depreciado em favor de `twenty-sdk`) | Risco de manutenção | Fixar versão do `twenty-sdk`; CI do app nos moldes de `packages/twenty-apps/examples/postcard/.github/workflows/ci.yml`; testes de schema como `src/__tests__/schema.integration-test.ts` |
| 6 | Notificações in-app persistentes não existem no Twenty (apenas snackbars e e-mail — canon) | Limitação atual | Notificar aprovador por e-mail (serviço) + `ProposalTimeline` no registro |
