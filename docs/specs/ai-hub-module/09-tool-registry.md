# 09 — Tool Registry

> Plataforma o2d-ai-platform · componente: **o2d-ai-gateway** (Tool Registry + Tool Call Validator + Tool Executor + Policy Engine + Approval Service).
> Status: **[PROPOSTO]** — nada implementado. Referências ao repositório real marcadas **[ATUAL]**. Pipeline completo de tool call: doc 05 do canon; aprovação humana: doc 15; dúvidas → doc 24.

## 1. Estado atual como referência [ATUAL]

O Twenty já possui um registry de tools para agentes — padrão análogo ao proposto, mas **não** é o registry da plataforma:

| O que existe | Onde (caminho real) |
|---|---|
| `ToolRegistryService` + `tool-executor.service.ts`, descoberta progressiva (`learn-tools` / `get-tool-catalog` / `execute-tool` / `load-skill`) | `packages/twenty-server/src/engine/core-modules/tool-provider/` |
| Categorias de tools | `packages/twenty-shared/src/ai/constants/tool-category.const.ts` (`DATABASE_CRUD`, `ACTION`, `WORKFLOW`, `METADATA`, `VIEW`, `DASHBOARD`, `NAVIGATION_MENU_ITEM`, `WEBHOOK`, `LOGIC_FUNCTION`) |
| Tools concretas (send-email, http com SSRF-guard, code-interpreter…) | `packages/twenty-server/src/engine/core-modules/tool/tools/` |

**Regra 18 do enunciado**: lógica crítica sob controle óDois. O registry da plataforma vive no **gateway** (Postgres do gateway, doc 16) — o `ToolRegistryService` do Twenty serve de referência de design, não de dependência. Ausência confirmada [ATUAL]: o Twenty não tem níveis de risco, aprovação humana de tool, versionamento semver de schema nem idempotência requerida.

## 2. Registro central (`ai_tool`) [PROPOSTO]

Cada tool registrada com:

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | text | Nome canônico (ex.: `proposal.create_draft`). Único por versão |
| `module` | text | Módulo de destino (executor real): `twenty-crm`, `proposal-service`, `contract-service`, `project-service`, `finance-service`, `gateway-internal` |
| `version` | semver | **Schema congelado por versão** — mudar input/output ⇒ nova versão; a versão registrada é a que valida (pipeline doc 05) |
| `description` | text | Texto exibido à LLM no catálogo filtrado |
| `inputSchema` / `outputSchema` | ref | Referências a **`o2d-ai-contracts`** (JSON Schema 2020-12, `<nome>@<semver>`) — nunca schema inline |
| `riskLevel` | enum | `READ` \| `LOW_WRITE` \| `SENSITIVE_WRITE` \| `CRITICAL` (`FORBIDDEN` não existe como linha — seção 4) |
| `confirmationPolicy` | enum | `NONE` \| `IN_CONVERSATION` (SENSITIVE_WRITE) \| `APPROVAL_REQUEST` (CRITICAL → `AIApprovalRequest`, doc 15) |
| `requiredPermissions` | text[] | Mapeadas a roles/permissões do **usuário iniciador** (on-behalf-of, regra 14) — validadas pelo Authorization Service antes de executar |
| `timeoutMs` | int | Timeout da execução no módulo destino |
| `idempotency` | jsonb | `{ required: boolean }` — **chave obrigatória para toda write** (`Idempotency-Key`, tabela `idempotency_key`, cenário 15) |
| `endpoint` | jsonb | URL da API do módulo proprietário + auth **S2S** (token de serviço + actor propagado). Tools `crm.*`: chamada ao Twenty via `packages/twenty-client-sdk` |
| `status` | enum | `ACTIVE` \| `DEPRECATED` \| `DISABLED` |
| `allowedWorkspaceIds` | uuid[] null | `null` = todos |
| `auditPolicy` | jsonb | Nível de detalhe gravado em `ai_tool_execution` (params sempre; masking de PII conforme doc 20) |
| `docsUrl` | text | Documentação interna da tool |

## 3. Catálogo canônico de tools [PROPOSTO]

Módulos de destino: `proposal.*` → **Serviço de Propostas** (specs irmãs em `docs/specs/proposal-module/`); `crm.*` → **Twenty** via `twenty-client-sdk`; demais → serviços proprietários correspondentes; `memory.search`/`document.search` → serviços internos do gateway (RAG/Memory, doc 13).

| Tool | Módulo destino | Risco | Política de confirmação | Notas |
|---|---|---|---|---|
| `crm.company.search` | Twenty (client-sdk) | READ | NONE | |
| `crm.company.get` | Twenty (client-sdk) | READ | NONE | |
| `crm.contact.search` | Twenty (client-sdk) | READ | NONE | |
| `crm.opportunity.get` | Twenty (client-sdk) | READ | NONE | |
| `proposal.search` | Serviço de Propostas | READ | NONE | |
| `proposal.get` | Serviço de Propostas | READ | NONE | |
| `project.get` | Serviço de Projetos | READ | NONE | |
| `project.get_status` | Serviço de Projetos | READ | NONE | |
| `project.list_delays` | Serviço de Projetos | READ | NONE | |
| `contract.search` | Serviço de Contratos | READ | NONE | |
| `contract.get` | Serviço de Contratos | READ | NONE | |
| `finance.get_customer_balance` | Serviço Financeiro | READ | NONE | Exige permissão financeira do usuário iniciador |
| `finance.list_overdue` | Serviço Financeiro | READ | NONE | |
| `memory.search` | Gateway (Memory Service) | READ | NONE | Filtro obrigatório workspace+permissões (doc 13) |
| `document.search` | Gateway (RAG Service) | READ | NONE | Idem |
| `proposal.create_draft` | Serviço de Propostas | LOW_WRITE | NONE (auditada) | Idempotency-Key obrigatória |
| `proposal.update_draft` | Serviço de Propostas | LOW_WRITE | NONE (auditada) | Idem |
| `proposal.generate_preview` | Serviço de Propostas | LOW_WRITE | NONE (auditada) | |
| `project.create_task` (`task.create`) | Serviço de Projetos | LOW_WRITE | NONE (auditada) | |
| `note.create` | Twenty (client-sdk) | LOW_WRITE | NONE (auditada) | |
| `contract.generate_draft` | Serviço de Contratos | LOW_WRITE | NONE (auditada) | |
| `contract.compare_versions` | Serviço de Contratos | LOW_WRITE | NONE (auditada) | |
| `meeting.summarize` | Gateway (tarefa `meeting.summarize`) | LOW_WRITE | NONE (auditada) | |
| `project.generate_report` | Serviço de Projetos | LOW_WRITE | NONE (auditada) | |
| `finance.simulate_installments` | Serviço Financeiro | LOW_WRITE | NONE (auditada) | Simulação, sem efeito contábil |
| `proposal.update_value` | Serviço de Propostas | SENSITIVE_WRITE | IN_CONVERSATION | Confirmação do usuário na conversa |
| `contract.generate_final` | Serviço de Contratos | SENSITIVE_WRITE | IN_CONVERSATION | |
| `finance.create_invoice` | Serviço Financeiro | SENSITIVE_WRITE | IN_CONVERSATION | |
| `proposal.request_approval` | Serviço de Propostas | SENSITIVE_WRITE | IN_CONVERSATION | |
| `proposal.approve` | Serviço de Propostas | CRITICAL | APPROVAL_REQUEST | **Dupla barreira** (seção 4.1) |
| `proposal.send` | Serviço de Propostas | CRITICAL | APPROVAL_REQUEST | **Dupla barreira** (seção 4.1) |
| `contract.sign` | Serviço de Contratos | CRITICAL | APPROVAL_REQUEST | |
| `payment.register` | Serviço Financeiro | CRITICAL | APPROVAL_REQUEST | |

## 4. As cinco classes de risco [PROPOSTO]

Listas **exatas** do canon:

| Classe | Comportamento | Tools |
|---|---|---|
| **READ** | Auto-executável (após pipeline de validação) | `crm.company.search`, `crm.company.get`, `crm.contact.search`, `crm.opportunity.get`, `proposal.search`, `proposal.get`, `project.get`, `project.get_status`, `project.list_delays`, `contract.search`, `contract.get`, `finance.get_customer_balance` (com permissão financeira), `finance.list_overdue`, `memory.search`, `document.search` |
| **LOW_WRITE** | Auto-executável + auditoria | `proposal.create_draft`, `proposal.update_draft`, `proposal.generate_preview`, `task.create` (`project.create_task`), `note.create`, `contract.generate_draft`, `contract.compare_versions`, `meeting.summarize`, `project.generate_report`, `finance.simulate_installments` |
| **SENSITIVE_WRITE** | Exige confirmação do usuário na conversa | `proposal.update_value`, `contract.generate_final`, `finance.create_invoice`, `proposal.request_approval` |
| **CRITICAL** | Aprovação humana forte via `AIApprovalRequest` (doc 15: hash de parâmetros, expiração, execução única) | `proposal.approve`, `proposal.send`, `contract.sign`, `payment.register` |
| **FORBIDDEN** | **Lista de negação documental** — essas operações **jamais são registradas no catálogo executável**; não existem como `ai_tool`, logo nunca aparecem no catálogo enviado ao modelo (cenário de teste 10) | `record.delete_permanently`, `permission.grant_admin`, `audit.delete`, `minimum_margin.update`, `secret.read` |

### 4.1 CRITICAL de propostas — dupla barreira

`proposal.approve` e `proposal.send` **delegam ao gate do Serviço de Propostas** (`docs/specs/proposal-module/`). Duas barreiras independentes, nenhuma substitui a outra:

1. **Aprovação de IA no gateway**: `AIApprovalRequest` aprovada por humano com role adequada (doc 15) — sem ela, o Tool Executor nem chama o módulo.
2. **Gate humano do módulo**: mesmo após a aprovação de IA, o Serviço de Propostas aplica seus próprios gates de aprovação/envio (máquina de estados dele). O executor final é sempre o módulo; o gateway adiciona a camada de aprovação de IA, não a substitui.

## 5. Filtragem do catálogo antes da LLM [PROPOSTO]

A LLM **só recebe o catálogo filtrado** (regra do pipeline, doc 05). Filtro aplicado na montagem de cada chamada, nesta ordem:

1. **Por agente**: interseção com `allowedTools` do agente (lista explícita, **nunca** "todas" — doc 10) e corte por `maxRiskLevel` do agente.
2. **Por usuário**: remove tools cujas `requiredPermissions` o usuário iniciador não possui (on-behalf-of).
3. **Por workspace**: `allowedWorkspaceIds` da tool × workspace do token (`X-O2d-Workspace-Id` validado).
4. **Por status**: só `ACTIVE` (DEPRECATED entra apenas se o agente a referenciar explicitamente, com log de aviso; DISABLED nunca).

Regras complementares:

- **`tool_choice` restrito**: a chamada ao provider envia `tool_choice` limitado ao catálogo filtrado (jamais `auto` sobre um catálogo maior); a LLM **só sugere** — quem executa é o Tool Executor após o pipeline completo (schema → usuário → workspace → role → risco → aprovação → executor). Tool sugerida fora do catálogo filtrado ⇒ `ai.tool.denied`.
- FORBIDDEN é invisível por construção (não existe no registro); o filtro nunca precisa removê-la.

## 6. Versionamento e depreciação [PROPOSTO]

- Versionamento **semver** com schema congelado: qualquer mudança de input/output ⇒ nova versão em `o2d-ai-contracts` + nova linha `ai_tool`. O Tool Call Validator valida contra o schema **da versão registrada** que foi oferecida à LLM.
- Fluxo: `ACTIVE` → `DEPRECATED` (janela de migração; agentes são atualizados para a versão nova) → `DISABLED` (nunca mais ofertada nem executável). Versões antigas nunca têm o schema reescrito.
- `AIApprovalRequest` referencia `tool+versão` (doc 15): aprovação de uma versão não vale para outra.

## 7. Registro de execução (`ai_tool_execution`) [PROPOSTO]

Toda execução (inclusive negadas) gera linha em `ai_tool_execution` (doc 16), vinculada à `ai_execution` pai:

| Campo | Notas |
|---|---|
| `executionId`, `toolName`, `toolVersion` | — |
| `workspaceId`, `actorUserId` | Usuário iniciador (on-behalf-of) |
| `paramsHash` / params auditados | sha256 do JSON canônico (mesmo hash do fluxo de aprovação); masking conforme `auditPolicy` |
| `idempotencyKey` | Obrigatória para writes |
| `status` | `VALIDATED` \| `DENIED` \| `APPROVAL_PENDING` \| `EXECUTED` \| `FAILED` |
| `resultSummary`, `latencyMs`, `correlationId` | Resultado passa pelo Structured Output Validator antes de voltar à LLM |

Eventos correspondentes (doc 18): `ai.tool.requested` / `validated` / `denied` / `approval_required` / `executed` / `failed`. Cenário de teste 18: toda execução gera auditoria completa.
