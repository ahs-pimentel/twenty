# 23 — Roadmap de Implementação

> Plataforma o2d-ai-platform · arquitetura **proposta** (não implementada).
> Em **todas as fases**, **NENHUM arquivo do repo Twenty é modificado** (verificável por diff). Todo o código vive em repositórios próprios da óDois (§2). Caminhos do repo Twenty aparecem apenas como referência de padrão [ATUAL].
> Migrations existem **apenas no Postgres do gateway** (decisão 5 do canon — zero migrations no core/Twenty).
> Dúvidas em aberto → doc 24. Canon: `CANON-AI`. Testes: doc 22 (cenários CT-01…CT-18).

## 1. Visão geral das fases (canon, doc 23)

| Fase | Tema | Resumo |
|---|---|---|
| F1 | Gateway mínimo | Provider OpenAI-compatible → Ollama/vLLM, `/v1/chat`, structured output, health, logs, auth de serviço |
| F2 | Twenty App | Painel, chat contextual, config providers/modelos, execuções |
| F3 | Tool Registry | Schemas, tools CRM/propostas, permissões, auditoria |
| F4 | Aprovação humana | Risco, AIApprovalRequest, UI, execução pós-aprovação, expiração/invalidação |
| F5 | Prompt + Agent Registry | Versionamento, publicação, agentes, rotas por tarefa, testes de prompt |
| F6 | RAG + memória | pgvector, fontes, memórias, filtros de permissão, reranking |
| F7 | MCP | Claude/Codex, OAuth/API keys, confirmações |
| F8 | Produção avançada | GPU/vLLM, escala, fallback, custos, observabilidade completa |

O invariante central (módulo → gateway → provedor; LLM nunca acessa banco nem executa ação direta) vale **desde a F1** — não é incremental.

## 2. Estrutura de repositórios (proposta)

```
o2d-ai-gateway/                # Serviço externo (NestJS/TS — decisão 2; alternativa FastAPI → doc 24)
├── src/
│   ├── auth/                  # Authentication + Authorization + Workspace Resolver
│   ├── providers/             # Provider Registry + adapters (openai-compatible, ollama, vllm, ...)
│   ├── models/                # Model Registry + Model Router + Fallback Service
│   ├── prompts/               # Prompt Registry
│   ├── agents/                # Agent Registry
│   ├── tools/                 # Tool Registry + Tool Call Validator + Tool Executor
│   ├── approvals/             # Approval Service
│   ├── policy/                # Policy Engine
│   ├── executions/            # Execution Service
│   ├── context/               # Context Builder + RAG Service + Memory Service
│   ├── validation/            # Structured Output Validator
│   ├── audit/  usage/  rate-limit/  health/
│   ├── events/                # outbox + relay + consumidores (doc 18)
│   └── queue-worker/          # worker BullMQ (padrão src/queue-worker/ do Twenty como referência)
├── migrations/                # ÚNICO lugar com migrations (Postgres do gateway)
├── deploy/                    # compose próprio da óDois (doc 21) — nunca em packages/twenty-docker/
├── test/integration/
└── e2e/

o2d-ai-hub-app/                # Twenty App proprietário (twenty-sdk; manifest por convenção)
├── application.config.ts
├── objects/                   # opcional: aiApprovalNotification (espelho leve, doc 16)
├── roles/  views/  page-layouts/  navigation-menu-items/
├── components/                # *.front-component.tsx (chat, painel, aprovações, execuções)
└── logic-functions/           # proxies UI → gateway (actor propagado)

o2d-ai-contracts/              # Fonte da verdade dos contratos
├── schemas/                   # JSON Schema 2020-12 <nome>@<semver>
│   ├── events/  tools/  responses/  agents/  api/
├── src/                       # bindings zod/TS gerados (Pydantic opcional)
└── scripts/                   # codegen + verificação de breaking change (CI)

o2d-ai-mcp/                    # Servidor MCP do gateway (doc 19)
├── src/
│   ├── server.ts              # transporte HTTP; initialize/tools/resources/prompts
│   ├── auth/                  # OAuth 2.1 / API key por usuário → identidade do gateway
│   ├── tools/  resources/  prompts/
└── test/
```

Referências de padrão no repo Twenty (somente leitura): app por convenção (`packages/twenty-apps/examples/postcard/`, `packages/twenty-sdk/src/sdk/define/index.ts`), worker (`packages/twenty-server/src/queue-worker/queue-worker.ts`), MCP nativo (`packages/twenty-server/src/engine/api/mcp/`), client tipado (`packages/twenty-client-sdk`).

---

## 3. F1 — Gateway mínimo

**Objetivos**: um serviço que fala com LLM local via contrato OpenAI-compatible e devolve texto e structured output validado, com auth de serviço, health e logs — nada de tools/agentes/RAG.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | `POST /v1/chat` (SSE) + `POST /v1/generate` + `POST /v1/extract`; `OpenAICompatibleProvider` (Ollama `/v1`); Model Registry mínimo (config estática) + roteamento por tarefa; Structured Output Validator (retry de correção 1×, `STRUCTURED_OUTPUT_INVALID`); `GET /v1/health`; logs estruturados com redator (doc 20 §2); auth de serviço (JWT + `X-O2d-Workspace-Id`, `Idempotency-Key`, `X-Correlation-Id`); tabelas base + outbox mínima (`ai.execution.*`) |
| Hub app | — (fase 2) |
| Contracts | Repo criado: envelope de API, `ai-event-envelope@1.0.0`, `ai.execution.*@1.0.0`, primeiro response schema (`proposal-extraction@1.0.0`); codegen zod + CI de breaking change |
| MCP | — |
| Infra | Compose dev (doc 21 §2): gateway + Postgres/pgvector + Redis + Ollama + MinIO, redes com LLM isolado |

**Dependências**: decisão NestJS vs FastAPI (doc 24 — bloqueante do primeiro commit); host de dev com Ollama e modelo escolhido (sizing inicial, doc 24); workspace piloto definido.

**Riscos**: qualidade do modelo local pequeno (mitigar: tarefa-alvo simples + goldens desde já); contrato OpenAI-compatible divergente entre Ollama/vLLM (mitigar: testes de contrato §2.3 do doc 22 com fixtures dos dois).

**Critérios de aceite**

- [ ] `POST /v1/extract` com `response_schema` devolve JSON validado ou `STRUCTURED_OUTPUT_INVALID` — nunca payload inválido
- [ ] LLM inalcançável de fora do gateway (rede) e sem credenciais de banco (CT-01)
- [ ] Logs sem segredos (CT-17); execução consultável com hashes/tokens/latência (CT-18 básico)
- [ ] Repetição com mesma `Idempotency-Key` não duplica execução (CT-15 no nível de API)
- [ ] Zero arquivos alterados no repo Twenty (diff)

**Testes**: doc 22 §2.1 (validadores, router mínimo, redator), §2.2, §2.3 (contracts+provider), §2.5; gate: **CT-01, CT-13, CT-15, CT-17, CT-18**.

**Migrations (Postgres do gateway)**: `ai_provider`, `ai_model`, `ai_model_route`, `ai_execution`, `ai_event_outbox`, `idempotency_key`.

**Impacto no deploy**: novo compose dev; nada muda no deploy do Twenty. **Fora da F1**: tools, aprovação, RAG, MCP, fallback externo, UI de prompts (desde a F1 os prompts mínimos já entram como registros com hash — nunca strings no código; o registry completo com estados/publicação é F5). **Esforço**: gateway G · contracts M · infra M.

> **Nota de compatibilidade — módulo de propostas**: a partir da F1, o Serviço de Propostas (docs/specs/proposal-module/14) **migra as chamadas LLM diretas para o gateway**: o doc 08-llm-spec daquele módulo previa Vercel AI SDK direto no worker; passa a chamar `POST /v1/extract` (tarefa `proposal.extract`) com token de serviço S2S. Nenhuma mudança nos gates de aprovação/envio do módulo.

---

## 4. F2 — Twenty App (hub)

**Objetivos**: UI de IA dentro do Twenty sem tocar o core: chat contextual, administração e visibilidade de execuções — tudo via gateway com actor propagado.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Auth tipo (a) — JWT de serviço com actor humano; endpoints de leitura (`/v1/executions/{id}`, `/v1/models`, `/v1/model-routes`, `/v1/providers`) |
| Hub app | App instalável (twenty-sdk): painel de administração (providers/modelos/rotas — leitura e edição via API do gateway), chat contextual (front component em side panel, streaming SSE), lista de execuções; roles do app; logic functions proxy |
| Contracts | Envelopes das respostas de leitura; schema do chat |
| MCP | — |
| Infra | Sem mudança estrutural; hub app publicado com `app:publish --private` |

**Dependências**: F1 em dev estável; workspace Twenty com suporte a apps; decisão de UX do chat (side panel vs página — doc 24, não bloqueante).

**Riscos**: limites do sandbox de front components (mitigar: POC cedo com `twenty-front-component-renderer` [ATUAL] como referência de capacidades); acoplamento acidental à IA nativa do Twenty (mitigar: regra 17 — a IA nativa pode ficar desabilitada; revisão de arquitetura no PR).

**Critérios de aceite**

- [ ] Chat contextual funciona em registro de company com o actor do usuário logado propagado ao gateway
- [ ] Execução disparada no chat aparece na lista com actor/workspace corretos
- [ ] Usuário do workspace A não vê execuções do workspace B (CT-05)
- [ ] IA nativa do Twenty desabilitada não afeta o hub app

**Testes**: doc 22 §2.2, §2.6 (multi-workspace), §2.14 (primeiro E2E com Twenty real); gate: acrescenta **CT-05**; regressão CT da F1.

**Migrations**: nenhuma nova obrigatória (ajustes em `ai_execution` p/ origem). **Impacto no deploy**: instalação do app no workspace piloto. **Fora da F2**: ações de IA que escrevem (dependem de tools, F3); administração de prompts/agentes (F5). **Esforço**: hub app G · gateway P · infra P.

---

## 5. F3 — Tool Registry

**Objetivos**: a LLM passa a **sugerir** tool calls; o gateway valida e executa via APIs de módulo — pipeline completo de risco até LOW_WRITE.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Tool Registry (schemas in/out versionados + nível de risco); Tool Call Validator; Policy Engine (catálogo filtrado por agente+usuário+workspace; FORBIDDEN inexistente no catálogo); Tool Executor (HTTP + token de serviço + actor); tools READ e LOW_WRITE do canon (crm.*, proposal.create_draft/update_draft/generate_preview, project.*, contract.search/get, memory.search stub); `GET /v1/tools`, `POST /v1/tools/{tool}/validate`, `/execute` (interno); eventos `ai.tool.*` |
| Hub app | Ações de IA em registros (ex.: "criar rascunho de proposta"); exibição de tool calls na execução |
| Contracts | `schemas/tools/*` (input/output por tool@versão); `ai.tool.*@1.0.0` |
| MCP | — |
| Infra | Sem mudança |

**Dependências**: F2; APIs dos módulos-alvo disponíveis (Serviço de Propostas F1 do roadmap dele, no mínimo endpoints de rascunho/prévia); mapeamento role Twenty ↔ permissões de tool (doc 24).

**Riscos**: explosão de escopo do catálogo (mitigar: só as tools do canon, classe por classe); módulos sem API estável (mitigar: contrato com fixtures — doc 22 §2.3 — e mocks até o módulo existir).

**Critérios de aceite**

- [ ] Tool call sugerida jamais executa sem passar pelo pipeline; chamada direta da LLM ao executor ⇒ 403 (CT-02)
- [ ] Tool call fora do schema rejeitada (CT-03); usuário sem permissão bloqueado (CT-04); workspace cruzado bloqueado (CT-05)
- [ ] FORBIDDEN ausente de qualquer catálogo enviado ao modelo (CT-10)
- [ ] Execução duplicada de tool não duplica efeito (CT-15)
- [ ] Auditoria reconstrói cada tool call ponta a ponta (CT-18 completo)

**Testes**: doc 22 §2.6, §2.7 (idempotência de tools), §2.13 (authz bypass); gate: acrescenta **CT-02, CT-03, CT-04, CT-10**; CT-18 promovido a completo.

**Migrations**: `ai_tool`, `ai_tool_execution`. **Impacto no deploy**: tokens de serviço S2S provisionados por módulo. **Fora da F3**: SENSITIVE/CRITICAL (aprovação é F4 — até lá essas tools **não são expostas**); agentes nomeados (F5). **Esforço**: gateway G · hub app M · contracts M.

---

## 6. F4 — Aprovação humana

**Objetivos**: liberar SENSITIVE_WRITE (confirmação) e CRITICAL (AIApprovalRequest) com garantia de execução única e invalidação por hash.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Approval Service (doc 15): PENDING/APPROVED/REJECTED/EXPIRED/INVALIDATED/EXECUTED; `paramsHash` sha256 canônico; execução única pós-aprovação; endpoints `/v1/approvals*`; worker de expiração (24h default); eventos `ai.approval.*`; política solicitante ≠ aprovador (configurável) |
| Hub app | Fila de aprovações pendentes + tela de decisão (parâmetros exibidos); notificação (objeto opcional `aiApprovalNotification`, doc 16) |
| Contracts | `ai.approval.*@1.0.0`; schema de exibição de parâmetros |
| MCP | — |
| Infra | Worker do gateway entra no compose (se ainda não estava) |

**Dependências**: F3; decisão de política default de aprovadores por workspace (doc 24); definição de quem tem role de aprovador no piloto.

**Riscos**: fila de aprovações virar gargalo (mitigar: notificação + métrica `o2d_ai_approval_pending` + expiração); decisão fora da UI (e-mail/print) sem registro (mitigar: decisão só via endpoints autenticados, nunca por fora).

**Critérios de aceite**

- [ ] Tool CRITICAL pausa execução e cria AIApprovalRequest (CT-07)
- [ ] Parâmetros alterados ⇒ INVALIDATED + nova solicitação (CT-08)
- [ ] Aprovação expirada inutilizável (CT-09)
- [ ] Aprovação executada não é reutilizável (replay bloqueado)
- [ ] Gates internos dos módulos permanecem: `proposal.approve/send` continuam sob o gate do Serviço de Propostas (camada adicional, não substituta)

**Testes**: doc 22 §2.7; gate: acrescenta **CT-07, CT-08, CT-09**.

**Migrations**: `ai_approval_request`. **Impacto no deploy**: nenhum novo serviço além do worker. **Fora da F4**: múltiplos aprovadores/quórum (backlog); aprovação via MCP (F7). **Esforço**: gateway G · hub app M.

---

## 7. F5 — Prompt Registry + Agent Registry

**Objetivos**: eliminar prompt em código; agentes nomeados com catálogo explícito de tools e rotas por tarefa.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Prompt Registry (`chave@semver`, estados DRAFT→TESTING→PUBLISHED→DEPRECATED→ARCHIVED, hash gravado em cada execução — doc 11); Agent Registry (doc 10: `allowedTools` explícitas, `maxRiskLevel`, `modelRoute`, roles/workspaces); `POST /v1/agents/{id}/run`; rotas por tarefa completas (aliases o2d-*) |
| Hub app | Administração de prompts (edição, publicação, changelog, test cases) e agentes; seleção de agente no chat |
| Contracts | Contratos de agente; `inputSchema`/`outputSchema` de prompts referenciando schemas existentes |
| MCP | — |
| Infra | Sem mudança |

**Dependências**: F3 (agentes usam tools) e F4 (agentes com `maxRiskLevel` ≥ SENSITIVE); catálogo inicial de agentes do canon (doc 24 valida quais entram no piloto).

**Riscos**: regressão silenciosa ao publicar prompt (mitigar: goldens obrigatórios na publicação — doc 22 §5); proliferação de agentes com tools demais (mitigar: `allowedTools` explícitas revisadas, nunca "todas").

**Critérios de aceite**

- [ ] Nenhuma string de prompt no código do gateway (verificação estática no CI)
- [ ] Toda execução grava `promptKey@version` + hash
- [ ] Publicação de prompt exige goldens verdes (CI)
- [ ] Agente só sugere tools do próprio `allowedTools` (catálogo filtrado)

**Testes**: doc 22 §2.1 (catálogo filtrado por agente), §5 (goldens + regressão de prompts no CI); regressão completa CT-01…CT-10, CT-13, CT-15, CT-17, CT-18.

**Migrations**: `ai_prompt`, `ai_agent`, ajustes em `ai_execution` (`promptKey`, `promptHash`, `agentId`). **Impacto no deploy**: nenhum. **Fora da F5**: memória/contexto rico (F6). **Esforço**: gateway G · hub app M · contracts P.

---

## 8. F6 — RAG + memória

**Objetivos**: contexto real — base documental com pgvector, memória de conversa/cliente, com filtro obrigatório de workspace+permissões.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Context Builder + RAG Service + Memory Service (doc 13): ingestão→chunking→embeddings (o2d-embedding local)→metadados obrigatórios→busca com predicado `workspaceId`+permissões→reranking (o2d-reranker)→citações `[fonte:id]`; `POST /v1/context/build`, `/v1/knowledge/search`, `/v1/memory/search`; worker de indexação; eventos `ai.knowledge.*`; expiração (`validUntil`) |
| Hub app | Administração de fontes de conhecimento; exibição de citações no chat |
| Contracts | Schemas de chunk/fonte/memória; `ai.knowledge.*@1.0.0` |
| MCP | — |
| Infra | MinIO em uso efetivo (originais); modelos de embedding/reranker no host de inferência |

**Dependências**: F5; escolha dos modelos de embedding/reranker locais (doc 24); fontes iniciais da óDois higienizadas.

**Riscos**: vazamento entre clientes/workspaces via busca vetorial (mitigar: predicado obrigatório testado — CT-05/CT-06 — e revisão de toda query); injection via documento (mitigar: corpus adversarial CT-14; documentos são dados, nunca instruções).

**Critérios de aceite**

- [ ] Toda query vetorial contém predicado `workspaceId` + filtro de permissões (teste automatizado de vazamento zero)
- [ ] Contexto de cliente X nunca contém chunks de cliente Y (CT-06)
- [ ] Instruções hostis em documento não alteram políticas/tools (CT-14)
- [ ] Respostas com citações resolvíveis; documentos expirados fora dos resultados

**Testes**: doc 22 §2.8, §2.9; gate: acrescenta **CT-06, CT-14**.

**Migrations**: `ai_knowledge_source`, `ai_knowledge_chunk` (pgvector), `ai_memory_fact`, `ai_conversation`, `ai_message`. **Impacto no deploy**: extensão pgvector habilitada; VRAM extra p/ embedding/reranker (doc 21 §5). **Fora da F6**: memória organizacional ampla; conectores externos de documentos. **Esforço**: gateway G · worker M · hub app M.

---

## 9. F7 — MCP

**Objetivos**: Claude/Codex e hosts autorizados operando as tools `o2d.*` com as permissões do usuário vinculado (doc 19).

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Auth tipo (c): emissão/validação de tokens MCP (OAuth 2.1 + API key por usuário); origem `mcp:{host}` na auditoria; rate limit por host |
| Hub app | Tela de vinculação/revogação de credenciais MCP por usuário |
| Contracts | Schemas das tools o2d.* MCP (mesmos do Tool Registry) |
| MCP | Repo `o2d-ai-mcp` completo: servidor, tools/resources/prompts, elicitation p/ SENSITIVE/CRITICAL, tradução de identidade → pipeline padrão (**zero camada paralela**) |
| Infra | Serviço mcp no compose (`:4100`), atrás do proxy |

**Dependências**: F3–F5 (tools, aprovação, agentes); decisão OAuth 2.1 vs API key como default (doc 24); hosts autorizados listados.

**Riscos**: superfície de ataque ampliada (mitigar: mesma authz, revalidação backend, CT-16, rate limit por host); host ignorar elicitation (mitigar: confirmação do host é UX — a segurança é o Approval Service).

**Critérios de aceite**

- [ ] Usuário via MCP tem exatamente as permissões que tem via hub app (CT-16)
- [ ] `tools/list` filtrado; FORBIDDEN nunca listada (CT-10 estendido ao MCP)
- [ ] Aprovar via MCP com credencial de agente ⇒ 403
- [ ] Auditoria de chamadas MCP idêntica ao pipeline padrão

**Testes**: doc 22 §2.10; gate: acrescenta **CT-16**.

**Migrations**: tabela de credenciais MCP por usuário (escopo/expiração/revogação). **Impacto no deploy**: novo container + rota no proxy. **Fora da F7**: MCP para terceiros fora da óDois. **Esforço**: mcp M · gateway M · hub app P.

---

## 10. F8 — Produção avançada

**Objetivos**: operação de produção completa: vLLM em GPU, fallback multi-nível, custos/limites, observabilidade completa e escala.

**Entregáveis por componente**

| Componente | Entregáveis |
|---|---|
| Gateway | Fallback Service completo (local principal → local secundário → externo autorizado → `MODEL_UNAVAILABLE`); flags por workspace/tarefa (`allowsSensitiveData`, externo opt-in); Usage Service + tabela de custos + limites com ações (doc 20 §6–7); Rate Limit Service completo; adapters `VLLMProvider` (métricas nativas) e externos opcionais (OpenAI/Anthropic) |
| Hub app | Dashboards de uso/custo por workspace; administração de limites e flags de fallback |
| Contracts | `ai.model.*`, `ai.provider.*` finalizados |
| MCP | Sem mudança |
| Infra | Deploy prod GPU (doc 21 §3): vLLM em host GPU, redes segregadas, Prometheus/Grafana/Loki/OTel/Alertmanager, backup WAL + MinIO versioning, réplicas de gateway/worker, HA opcional |

**Dependências**: F1–F7 estáveis no piloto; aquisição/aluguel do host GPU (sizing doc 21 §5, decisão doc 24); contratos com providers externos **se** habilitados.

**Riscos**: custo/entrega da GPU (mitigar: prod pequena com Ollama segura o piloto; vLLM entra sem mudança de contrato — só provider); fallback externo vazando dado sensível (mitigar: `allowsSensitiveData` + CT-12 + tarefas local-only).

**Critérios de aceite**

- [ ] Local indisponível ⇒ fallback conforme política (CT-11); externo desativado ⇒ zero chamadas externas (CT-12)
- [ ] `ai_usage_record` para toda execução (mesmo local), custo estimado agregável por workspace/usuário/tarefa
- [ ] Limites aplicam throttle/alerta/bloqueio conforme configuração (429 testado)
- [ ] Dashboards e alertas do doc 20 §5 operacionais; alerta de provider offline dispara em < 2 min
- [ ] Suíte de carga (doc 22 §2.12) com metas de p95/throughput registradas

**Testes**: doc 22 §2.4, §2.11, §2.12; gate: acrescenta **CT-11, CT-12** — com isso, **CT-01…CT-18 completos** viram o gate permanente.

**Migrations**: `ai_usage_record` (se ainda parcial), tabelas de limites/política de fallback. **Impacto no deploy**: maior da série — novo host GPU + stack de observabilidade. **Fora da F8 (backlog)**: HA completa multi-região; multi-GPU com tensor parallelism; billing por workspace ao estilo créditos. **Esforço**: infra G · gateway G · hub app M.

---

## 11. Rollout, flags e rollback

| Mecanismo | Descrição |
|---|---|
| Workspace piloto | Cada fase entra primeiro em 1 workspace piloto da óDois; expansão só após observação com métricas (execuções/dia, taxa de erro, custo, aprovações pendentes) |
| Feature flags | Capacidades por fase atrás de flags do gateway **por workspace** (ex.: `FEATURE_TOOLS`, `FEATURE_APPROVALS`, `FEATURE_RAG`, `FEATURE_MCP`, `FEATURE_EXTERNAL_FALLBACK`); o hub app esconde UI de recurso desligado; o gateway rejeita chamadas de recurso desligado (a barreira é o backend) |
| Rollback | (1) desligar a flag; (2) rollback de imagem do gateway/worker — migrations forward-compatible (expand/contract), nunca destrutivas dentro de uma fase; (3) tabelas de auditoria/aprovação são append-only e nunca sofrem rollback de dados; (4) desinstalar o hub app não apaga histórico (vive no Postgres do gateway) |
| Gate de release | Suíte CT acumulada da fase (doc 22 §4) obrigatória em toda promoção de fase e todo deploy |

## 12. Alinhamento com o módulo de propostas

- O Serviço de Propostas (specs irmãs em `docs/specs/proposal-module/`) torna-se **consumidor** do gateway a partir da **F1**: tarefas `proposal.extract`/`proposal.write` via `POST /v1/extract`/`/v1/generate` com token S2S, substituindo a chamada direta ao Vercel AI SDK prevista no doc 08-llm-spec daquele módulo (nota de compatibilidade registrada lá e no impact map).
- Na **F3**, as tools `proposal.*` do Tool Registry apontam para a API do Serviço de Propostas; na **F4**, a aprovação de IA se soma — **sem substituir** — aos gates internos do módulo (`canSendProposal` e a regra central do doc 09 §1.2 daquele spec continuam soberanos no serviço).
- O MCP do módulo de propostas (proposal-module F4, doc 14 §6) e o `o2d-ai-mcp` coexistem: tools `proposal.*` críticas continuam com elicitation + gates do módulo em qualquer caminho.
