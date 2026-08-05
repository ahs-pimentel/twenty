# 10 — Agent Registry (Registro de Agentes)

> Plataforma o2d-ai-platform — especificação proprietária da óDois.
> Status: **[PROPOSTO]** — nada deste documento está implementado. Referências de código marcadas **[ATUAL]** apontam para o estado real do repositório Twenty e servem apenas como contexto conceitual.

## 1. Contexto e decisão de arquitetura

### 1.1 [ATUAL] Agentes nativos do Twenty (referência conceitual)

O Twenty possui um módulo de agentes de IA nativo em `packages/twenty-server/src/engine/metadata-modules/ai/`:

- **Entidade de agente**: `packages/twenty-server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity.ts` — campos `name`, `label`, `description`, `prompt` (texto livre inline), `modelId` (default `AUTO_SELECT_SMART_MODEL_ID`), `responseFormat` (jsonb), `modelConfiguration` (jsonb), `isCustom`, com índice único por `(name, workspaceId)`.
- **Roles de agente**: `packages/twenty-server/src/engine/metadata-modules/ai/ai-agent-role/` — agentes recebem roles via role-target, respeitando o RBAC do Twenty.
- **Execuções**: `packages/twenty-server/src/engine/metadata-modules/ai/ai-agent-execution/` — turnos/mensagens persistidos no padrão UIMessage.
- **Prompts de sistema em constantes**: `packages/twenty-server/src/engine/metadata-modules/ai/ai-agent/constants/agent-system-prompts.const.ts` (ver doc 11 — este é exatamente o antipadrão que a plataforma proíbe).

Esse modelo é uma referência conceitual útil (agente = prompt + modelo + formato de resposta + role), mas **não é o motor da plataforma**.

### 1.2 [PROPOSTO] Registry próprio no gateway

Pelas regras 17 e 18 do canon (não depender da IA experimental do Twenty; lógica crítica sob controle da óDois), o **Agent Registry vive no o2d-ai-gateway**, com persistência na tabela `ai_agent` do Postgres do gateway (doc 16). A IA nativa do Twenty pode permanecer desabilitada sem impacto algum na plataforma. O hub app (`o2d-ai-hub-app`) é apenas UI de administração e consumo — nenhuma definição de agente é armazenada no Twenty.

Diferenças estruturais em relação ao modelo nativo:

| Aspecto | Twenty nativo [ATUAL] | o2d Agent Registry [PROPOSTO] |
|---|---|---|
| Prompt | String inline na entidade (`prompt: text`) | Referência ao Prompt Registry (`chave@semver`), nunca inline |
| Modelo | `modelId` direto (nome de modelo) | `modelRoute` por tarefa/alias (doc 06/08 — trocar modelo não altera o agente) |
| Tools | Catálogo por categoria + role | **Allowlist explícita por agente** (nenhum agente recebe todas) |
| Risco | Inexistente | `maxRiskLevel` + `approvalPolicy` integrados ao Policy Engine |
| Versionamento | Inexistente | Versão semântica por agente, histórico imutável |
| Workspace | `workspaceId` na entidade | `allowedWorkspaces` + isolamento em todo o pipeline |

## 2. Catálogo canônico de agentes

Nove agentes canônicos. As tools listadas são **subconjuntos explícitos** do catálogo canônico de tools (doc 05); nenhum agente recebe o catálogo completo. `memory.search` e `document.search` só aparecem em agentes cujo `contextSources` inclui a camada correspondente.

| Agente (id) | Propósito | modelRoute típica | Tools permitidas (allowlist) | Fontes de contexto | Memória | maxRiskLevel |
|---|---|---|---|---|---|---|
| `agent.general` (assistente geral) | Chat contextual genérico no Twenty; perguntas sobre o registro aberto e navegação | `chat.general`, `chat.contextual` | `crm.company.search`, `crm.company.get`, `crm.contact.search`, `crm.opportunity.get`, `memory.search`, `document.search`, `note.create`, `task.create` | contexto imediato, memória de conversa, memória do cliente, base documental | conversa + leitura de fatos | LOW_WRITE |
| `agent.sales` (comercial) | Apoio a oportunidades: resumo do cliente, follow-ups, próximos passos | `customer.summarize`, `chat.contextual` | `crm.company.search`, `crm.company.get`, `crm.contact.search`, `crm.opportunity.get`, `proposal.search`, `proposal.get`, `memory.search`, `note.create`, `task.create` | contexto imediato, memória de conversa, memória do cliente | conversa + leitura e escrita de fatos (curados) | LOW_WRITE |
| `agent.proposal` (propostas) | Extração e redação de propostas; drafts e previews via Serviço de Propostas | `proposal.extract`, `proposal.write` | `crm.company.search`, `crm.company.get`, `crm.contact.search`, `proposal.search`, `proposal.get`, `proposal.create_draft`, `proposal.update_draft`, `proposal.generate_preview`, `proposal.update_value`*, `proposal.request_approval`*, `memory.search`, `document.search` | contexto imediato, memória do cliente, base documental (templates, propostas anteriores) | conversa + leitura de fatos | SENSITIVE_WRITE |
| `agent.contract` (contratos) | Análise, comparação e rascunho de contratos | `document.analyze` | `contract.search`, `contract.get`, `contract.generate_draft`, `contract.compare_versions`, `contract.generate_final`*, `document.search`, `memory.search` | contexto imediato, base documental (contratos, políticas) | leitura de fatos | SENSITIVE_WRITE |
| `agent.project` (projetos) | Status, atrasos, relatórios e tarefas de projetos | `chat.contextual` | `project.get`, `project.get_status`, `project.list_delays`, `project.generate_report`, `task.create`, `note.create`, `memory.search`, `document.search` | contexto imediato, memória de conversa, base documental (atas, requisitos) | conversa + leitura de fatos | LOW_WRITE |
| `agent.finance` (financeiro) | Saldos, inadimplência, simulações e faturas | `chat.contextual` | `finance.get_customer_balance`, `finance.list_overdue`, `finance.simulate_installments`, `finance.create_invoice`*, `crm.company.get`, `memory.search` | contexto imediato, memória do cliente (fatos financeiros) | leitura de fatos | SENSITIVE_WRITE |
| `agent.meeting` (reuniões) | Sumarização de reuniões, extração de decisões e ações | `meeting.summarize` | `meeting.summarize`, `task.create`, `note.create`, `crm.company.get`, `crm.contact.search`, `memory.search` | contexto imediato, base documental (atas), memória do cliente | conversa + escrita de fatos candidatos (curadoria, doc 13) | LOW_WRITE |
| `agent.requirements` (requisitos) | Extração estruturada de requisitos a partir de documentos e conversas | `requirements.extract`, `document.analyze` | `document.search`, `project.get`, `note.create`, `task.create`, `memory.search` | base documental (visão, requisitos, manuais), contexto imediato | leitura de fatos | LOW_WRITE |
| `agent.document` (documentos) | Busca semântica e análise da base documental com citações | `semantic.search`, `document.analyze`, `chat.contextual` | `document.search`, `memory.search`, `crm.company.get`, `note.create` | base documental (todas as fontes permitidas ao usuário), memória organizacional | leitura de fatos | LOW_WRITE |

\* Tools SENSITIVE_WRITE: presentes na allowlist, mas toda sugestão passa por confirmação do usuário na conversa (doc 15). Nenhum agente do catálogo canônico possui tools CRITICAL na allowlist inicial (`proposal.approve`, `proposal.send`, `contract.sign`, `payment.register` exigem habilitação explícita por workspace + `approvalPolicy` correspondente); tools FORBIDDEN não existem no catálogo e jamais são atribuíveis.

## 3. Contrato do agente (campos canônicos)

Persistido em `ai_agent` (doc 16). Validado contra schema `agent-definition@1.0.0` do pacote `o2d-ai-contracts`.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string (slug) | sim | Identificador estável, ex.: `agent.proposal`. Imutável entre versões. |
| `name` | string | sim | Nome de exibição, ex.: "Agente de Propostas". |
| `description` | string | sim | Propósito e limites do agente (exibido no hub app e no catálogo). |
| `version` | semver | sim | Versão da definição do agente (ver §4). |
| `systemPrompt` | string (`chave@semver`) | sim | **Referência ao Prompt Registry (doc 11)** — ex.: `agent.proposal.system@1.2.0`. **Nunca texto inline** (regra 12 do canon). |
| `modelRoute` | string | sim | Rota/tarefa de modelo (doc 06/08), ex.: `proposal.write`. Nunca nome de modelo/provider. |
| `allowedTools` | string[] (nome@versão) | sim | **Allowlist explícita.** Lista vazia = agente sem tools. Não existe curinga `*`; NENHUM agente recebe todas as tools. |
| `contextSources` | enum[] | sim | Subconjunto de: `immediate_record`, `conversation`, `customer_memory`, `document_base`, `org_memory` (doc 13). |
| `memoryPolicy` | objeto | sim | `{ read: boolean, writeFacts: boolean, conversationWindow: number, summarization: boolean }` — o que o agente pode ler/gravar de memória. |
| `allowedRoles` | string[] | sim | Roles do Twenty que podem invocar o agente (vazio = qualquer usuário autenticado do workspace). |
| `allowedWorkspaces` | string[] \| `"all"` | sim | Workspaces onde o agente está disponível. |
| `maxRiskLevel` | enum | sim | Teto de risco: `READ` \| `LOW_WRITE` \| `SENSITIVE_WRITE` \| `CRITICAL`. Tool sugerida acima do teto ⇒ negada pelo Policy Engine mesmo se estiver na allowlist. |
| `approvalPolicy` | objeto | sim | Política de aprovação: `{ sensitiveWrite: "user_confirmation", critical: "approval_request", approverRoles: string[], requesterCannotApprove: boolean }` (doc 15). |
| `temperature` | number | sim | Default da geração (pode ser sobrescrito pelo prompt publicado, doc 11). |
| `maxTokens` | number | sim | Limite de tokens de saída por execução. |
| `timeout` | number (ms) | sim | Timeout da execução; excedido ⇒ `ai.execution.failed`. |
| `active` | boolean | sim | Agente inativo não aparece em catálogos nem aceita `run`. |

Regras de validação no registro:

1. Toda tool em `allowedTools` deve existir no Tool Registry na versão indicada e ter risco ≤ `maxRiskLevel`.
2. `systemPrompt` deve referenciar um prompt em estado `PUBLISHED` (doc 11) no momento da ativação do agente.
3. `memory.search`/`document.search` na allowlist exigem a fonte de contexto correspondente em `contextSources`.
4. Agente com qualquer tool `SENSITIVE_WRITE`/`CRITICAL` exige `approvalPolicy` completa.

## 4. Versionamento de agentes

- Cada alteração de definição gera **nova versão** (semver) em `ai_agent`; versões publicadas são imutáveis (mesmo padrão do Prompt Registry, doc 11).
  - **patch**: descrição, temperatura, timeout, maxTokens.
  - **minor**: bump de versão de prompt/tool referenciada, adição de tool de risco ≤ atual, novas fontes de contexto.
  - **major**: mudança de `modelRoute`, aumento de `maxRiskLevel`, mudança de `approvalPolicy`, remoção de tool.
- Toda `ai_execution` grava `agentId` + `agentVersion` (além do hash do prompt resolvido) — reprodutibilidade e auditoria completas (regra 13 do canon).
- Rollback = reativar versão anterior; nunca editar versão publicada.
- Aumento de `maxRiskLevel` ou adição de tool `SENSITIVE_WRITE`/`CRITICAL` exige aprovação de administrador da plataforma no hub app (dupla confirmação).

## 5. Execução

Endpoint canônico (doc 17):

```
POST /v1/agents/{agentId}/run
Authorization: <JWT de serviço com actor | S2S | MCP>
X-O2d-Workspace-Id: <workspaceId>
Idempotency-Key: <chave>
X-Correlation-Id: <id>
```

Fluxo (resumo; pipeline completo no doc 05):

1. Gateway resolve o agente ativo (ou versão pinada pelo chamador) e valida: workspace ∈ `allowedWorkspaces`, role do actor ∈ `allowedRoles`, agente `active`.
2. Resolve `systemPrompt` no Prompt Registry (versão exata; hash gravado), monta contexto via Context Builder conforme `contextSources` e `memoryPolicy` (sempre com filtros de workspace + permissões do usuário iniciador — on-behalf-of, regra 14).
3. Model Router resolve `modelRoute` → provider/modelo (fallback do doc 06; dados sensíveis respeitam `allowsSensitiveData`).
4. LLM recebe **apenas o catálogo filtrado**: `allowedTools` ∩ tools permitidas ao usuário ∩ tools ativas no workspace, com risco ≤ `maxRiskLevel`. Tools FORBIDDEN nem existem no catálogo enviado ao modelo (cenário de teste 10, doc 22).
5. Toda tool call sugerida passa pelo pipeline de validação/aprovação (doc 05/15); a LLM nunca executa nada diretamente (regras 1–4).
6. Cria-se um registro em `ai_execution` (com `ai_tool_execution` filhos por tool call), com `inputHash`, `outputHash`, tokens, latência, custo, `correlationId`. Eventos `ai.execution.*` publicados via outbox (doc 18).

Respostas assíncronas (execuções longas, aprovações pendentes) retornam `executionId` consultável via `GET /v1/executions/{executionId}`; `POST /v1/executions/{executionId}/cancel` e `/retry` disponíveis.

## 6. Administração via hub app (Fase F5)

O `o2d-ai-hub-app` (Twenty App, doc do hub) oferece as telas de administração — todas como proxy para a API do gateway (nenhum dado de agente persistido no Twenty, doc 16):

- Listagem/edição de agentes (criação de nova versão, diff entre versões, ativação/desativação).
- Gestão da allowlist de tools com visualização do nível de risco de cada tool.
- Vínculo de prompt (seleção de `chave@versão` publicada no Prompt Registry).
- Habilitação por workspace e por role.
- Visualização de execuções (`ai_execution`) e fila de aprovações pendentes por agente.
- Métricas por agente (tokens, custo, latência, taxa de aprovação/rejeição — doc 20).

Entrega conforme roadmap (doc 23): o Agent Registry completo chega na **Fase F5** (junto com o Prompt Registry); nas fases anteriores o gateway opera com tarefas diretas (`/v1/chat`, `/v1/extract`) sem agentes.

## 7. Questões em aberto (→ doc 24)

- Granularidade de `allowedWorkspaces` vs. habilitação por workspace no Policy Engine (evitar duplicidade de configuração).
- Se agentes poderão ser definidos por workspace (custom) além do catálogo canônico global — e, nesse caso, quem aprova allowlists de tools.
