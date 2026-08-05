# 11 — Prompt Registry (Registro Versionado de Prompts)

> Plataforma o2d-ai-platform — especificação proprietária da óDois.
> Status: **[PROPOSTO]** — nada deste documento está implementado. Referências **[ATUAL]** apontam para o estado real do repositório Twenty.

## 1. Problema: prompts como strings no código

### 1.1 [ATUAL] Estado do Twenty

No Twenty, prompts de sistema vivem como **constantes hardcoded no código**. Exemplo real:

- `packages/twenty-server/src/engine/metadata-modules/ai/ai-agent/constants/agent-system-prompts.const.ts` — `WORKFLOW_SYSTEM_PROMPTS` com prompts `BASE` e `OUTPUT_GENERATOR` como template literals TypeScript (há ainda `CHAT_SYSTEM_PROMPTS` no submódulo `ai-chat/`).
- O campo `prompt` da entidade de agente (`ai-agent/entities/agent.entity.ts`) é texto livre inline, sem versionamento, estados, testes ou changelog.

Consequências desse padrão: alterar um prompt exige deploy; não há histórico auditável de qual prompt produziu qual saída; não há testes de regressão de prompt; não há rollout gradual nem rollback; não há revisão/publicação formal.

### 1.2 [PROPOSTO] Regra da plataforma

A **regra 12 do canon proíbe prompts como strings no código**: todo prompt usado pela plataforma vive no **Prompt Registry** do o2d-ai-gateway, persistido em `ai_prompt` (Postgres do gateway, doc 16), versionado e auditável. Nenhum módulo consumidor, hub app ou worker embute texto de prompt — apenas referências `chave@versão`.

## 2. Identificação: `chave@semver`

Cada prompt é identificado por `chave@versão` (semver). Chaves seguem o padrão das tarefas canônicas (doc 06). Exemplos canônicos:

| Chave | Uso |
|---|---|
| `proposal.extract@1.0.0` | Extração estruturada de dados de proposta a partir de mensagem livre |
| `proposal.write@1.0.0` | Redação do texto de proposta |
| `meeting.summarize@1.0.0` | Sumarização de reuniões/atas |
| `document.analyze@1.0.0` | Análise de documentos com citações |
| `requirements.extract@1.0.0` | Extração de requisitos |
| `customer.summarize@1.0.0` | Resumo consolidado de cliente |
| `agent.general.system@1.0.0` | Prompt de sistema do assistente geral (referenciado pelo Agent Registry, doc 10) |

Convenção de bump:

- **patch** — correção de texto sem mudança de comportamento esperado (goldens continuam passando inalterados).
- **minor** — melhoria de instruções, novas variáveis opcionais, compatível com o mesmo `outputSchema`.
- **major** — mudança de `inputSchema`/`outputSchema`, de `modelRoute` ou de comportamento esperado.

## 3. Ciclo de vida (estados e transições)

```
DRAFT → TESTING → PUBLISHED → DEPRECATED → ARCHIVED
```

| Transição | Quem pode | Regras |
|---|---|---|
| criar `DRAFT` | qualquer editor de prompts (permissão no hub app) | Edição livre; nunca resolvível em runtime de produção. |
| `DRAFT → TESTING` | editor | Exige: casos de teste definidos (≥ 1 golden), `inputSchema`/`outputSchema` referenciando `o2d-ai-contracts`. |
| `TESTING → PUBLISHED` | **apenas publicador** (role dedicada; autor ≠ publicador configurável por workspace) | Exige: todos os goldens passando no CI de prompts (§6); changelog preenchido. Grava `publishedAt` e `author`. |
| `PUBLISHED` | — | **Imutável.** Qualquer mudança de conteúdo ⇒ nova versão em `DRAFT`. Conteúdo publicado tem hash sha256 fixo. |
| `PUBLISHED → DEPRECATED` | publicador | Exige versão substituta `PUBLISHED` e **prazo de desativação** (`deprecatedAt` + janela, default 30 dias). Durante a janela, resoluções emitem aviso (log/warning no envelope) mas funcionam. |
| `DEPRECATED → ARCHIVED` | publicador (automático ao fim do prazo, via worker) | Deixa de ser resolvível em runtime (`PROMPT_ARCHIVED`); permanece armazenado para auditoria (execuções antigas continuam reproduzíveis). |
| `TESTING → DRAFT` | editor | Reprovação em teste; volta para edição. |

Não há transição de volta a partir de `PUBLISHED` — rollback é feito apontando consumidores/agentes para a versão anterior ainda `PUBLISHED`.

## 4. Contrato do prompt (campos canônicos)

Persistido em `ai_prompt` (doc 16); validado contra `prompt-definition@1.0.0` de `o2d-ai-contracts`.

| Campo | Tipo | Descrição |
|---|---|---|
| `key` | string | Chave estável, ex.: `proposal.extract`. |
| `version` | semver | Versão desta entrada. `key@version` é único. |
| `status` | enum | `DRAFT` \| `TESTING` \| `PUBLISHED` \| `DEPRECATED` \| `ARCHIVED`. |
| `content` | string (template) | Corpo do prompt com variáveis `{{nomeDaVariavel}}` (sintaxe mustache-like, sem lógica — apenas interpolação e blocos condicionais `{{#var}}...{{/var}}` para variáveis opcionais). |
| `variables` | objeto[] | Variáveis tipadas: `{ name, type: "string"\|"number"\|"boolean"\|"json", required, description, example }`. Toda variável usada em `content` deve estar declarada; interpolação de variável não declarada ⇒ erro de registro. |
| `inputSchema` | ref | JSON Schema 2020-12 (ref `o2d-ai-contracts`) do input da tarefa que usa o prompt. |
| `outputSchema` | ref | JSON Schema 2020-12 (ref `o2d-ai-contracts`) do output esperado, ex.: `proposal-extraction@1.0.0` (doc 12). Obrigatório para tarefas estruturadas; ausente apenas em prompts de chat livre. |
| `modelRoute` | string | Rota de modelo recomendada (doc 06), ex.: `o2d-extraction`. O executor pode sobrescrever apenas dentro das políticas do Model Router. |
| `temperature` | number | Temperatura recomendada para este prompt. |
| `maxTokens` | number | Limite de tokens de saída recomendado. |
| `author` | string | Identidade de quem criou a versão. |
| `publishedAt` | timestamp \| null | Data de publicação. |
| `deprecatedAt` | timestamp \| null | Data de depreciação (início da janela de desativação). |
| `testCases` | objeto[] | Goldens executáveis (§6): `{ name, variables, input, expected: { schemaValid: true, assertions[] }, modelRoute? }`. |
| `changelog` | string | O que mudou nesta versão e por quê. Obrigatório para publicar. |

## 5. Resolução em runtime

1. Toda execução referencia **prompt@versão exata**. Consumidores podem pedir `key` sem versão apenas em ambientes de desenvolvimento; em produção o Agent Registry/Execution Service resolve para a versão `PUBLISHED` vigente e **congela** essa versão na execução.
2. O gateway interpola as variáveis (validadas contra `variables`/`inputSchema`) e envia ao modelo.
3. O **hash sha256 do conteúdo resolvido** (template publicado + registro da versão) é gravado em `ai_execution` (doc 16) — auditoria e reprodutibilidade: dado um `executionId`, sabe-se exatamente qual texto de prompt foi usado (regra 13).
4. Status inválido em produção: `DRAFT`/`TESTING` ⇒ erro `PROMPT_NOT_PUBLISHED`; `ARCHIVED` ⇒ `PROMPT_ARCHIVED`; `DEPRECATED` ⇒ funciona com warning até o fim do prazo.

### Rollout (canary por workspace)

A versão `PUBLISHED` vigente é resolvida por workspace: o registry suporta apontar workspaces específicos para uma versão mais nova (`canaryWorkspaces: [wsA, wsB]`) enquanto os demais permanecem na estável. Promoção a default global após validação das métricas (taxa de `ai.structured_output.invalid`, aprovações rejeitadas, latência — doc 20). Rollback de canary = remover o apontamento.

## 6. Testes de prompt (CI de prompts)

- Cada versão carrega `testCases` — **goldens executáveis**: conjunto de variáveis + input, executados contra a `modelRoute` do prompt (em CI: provider local/estável, temperatura 0 quando aplicável).
- Critérios de aprovação por caso: (a) saída **valida contra `outputSchema`** (pipeline do doc 12); (b) asserções declarativas passam (ex.: `assertions: [{ path: "$.intent", equals: "create_proposal" }, { path: "$.confidence", gte: 0.8 }]`).
- O CI de prompts roda: na transição `DRAFT → TESTING` (gate), na publicação (gate) e periodicamente via worker contra os prompts `PUBLISHED` (detecção de drift quando modelos locais são atualizados) — falha periódica gera alerta, não despublicação automática.
- Goldens também protegem contra regressão de prompt injection: casos com conteúdo adversarial no input devem manter o output dentro do schema e das regras (alinhado ao cenário 14 do doc 22).

## 7. Administração e eventos

- CRUD/edição/publicação via hub app (F5, doc 23) — sempre proxy para a API do gateway; nada persistido no Twenty.
- Auditoria: toda transição de estado gera registro de auditoria (Audit Service) com actor humano.
- Execuções expõem `promptKey`, `promptVersion`, `promptHash` em `GET /v1/executions/{executionId}` (doc 17).

## 8. Questões em aberto (→ doc 24)

- Janela default de deprecation (proposta: 30 dias) e política para prompts usados por agentes ativos (bloquear archive enquanto houver agente apontando).
- Orçamento de execução do CI periódico de goldens (custo/tokens) por ambiente.
