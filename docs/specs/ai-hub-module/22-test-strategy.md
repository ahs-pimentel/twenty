# 22 — Estratégia de Testes

> Plataforma o2d-ai-platform · escopo: **o2d-ai-gateway**, **o2d-ai-hub-app**, **o2d-ai-contracts**, **o2d-ai-mcp** (repositórios próprios da óDois).
> Status: especificação — **nada aqui está implementado**. Marcações: **[ATUAL]** = padrão existente no repositório Twenty (caminhos reais); **[PROPOSTO]** = plano de teste da plataforma.
> Dúvidas em aberto → doc 24. Canon: `CANON-AI`.

## 1. Padrões do repositório Twenty a espelhar [ATUAL]

| Camada | Padrão atual no repo | Caminho real |
|---|---|---|
| Unitário (server) | Jest + `@swc/jest`, `*.spec.ts` colocated | `packages/twenty-server/jest.config.mjs` |
| Integração (server) | `*.integration-spec.ts`, banco/Redis reais, `maxWorkers: 1`, `.env.test` | `packages/twenty-server/test/integration/{ai,graphql,metadata,rest,...}` |
| E2E | Playwright | `packages/twenty-e2e-testing/` |
| CI | Workflows GitHub Actions por pacote | `.github/workflows/ci-server.yaml`, `ci-front.yaml`, `ci-twenty-apps.yaml`, `ci-sdk.yaml`, `ci-e2e-main.yaml` |

Decisões derivadas [PROPOSTO]: cada repositório da plataforma (gateway, hub app, contracts, mcp) tem CI próprio no mesmo desenho (lint, typecheck, unit, integração); o **gate de release** inclui a suíte da §4.

## 2. Categorias de teste [PROPOSTO]

### 2.1 Unitários

Jest + `@swc/jest`, sem I/O real.

| Alvo | Casos exemplares |
|---|---|
| Model Router | Tarefa → alias → modelo; exclusão de provider externo quando tarefa é local-only (`allowsSensitiveData`); tarefa sem rota ⇒ `MODEL_UNAVAILABLE` |
| Policy Engine | Matriz risco × política de workspace; FORBIDDEN nunca autorizável; `maxRiskLevel` do agente limita catálogo |
| Validadores | Zod gerado do JSON Schema: campo extra, tipo errado, enum inválido, datas não ISO-8601, moeda sem `amountMicros` ⇒ rejeição |
| Hash de aprovação | `paramsHash` = sha256 do JSON canônico (chaves ordenadas); qualquer mudança de parâmetro muda o hash; campos voláteis fora do hash |
| Catálogo filtrado | Montagem do catálogo para agente+usuário+workspace nunca inclui FORBIDDEN nem tools fora de `allowedTools` |
| Redator de logs | Segredos/PII mascarados em todos os formatos de campo conhecidos |

### 2.2 Integração

`*.integration-spec.ts`, **Postgres+pgvector e Redis reais** (containers de serviço no CI), `maxWorkers: 1`, `.env.test`. Inferência: **Ollama em container** (modelo mínimo) **OU mock OpenAI-compatible determinístico** (§2.5) — o CI usa o mock por padrão; job noturno opcional usa Ollama real.

- Endpoints `/v1/*` (doc 17) fim a fim com banco real, incluindo códigos de erro canônicos.
- Outbox transacional: efeito + evento na mesma transação; relay publica; crash simulado entre commit e publish não perde evento.
- Pipeline completo de tool call com módulos mockados (HTTP).

### 2.3 Contrato

| Contrato | Verificação |
|---|---|
| `o2d-ai-contracts` | Todo schema `<nome>@<semver>` validado no CI; breaking change sem major quebra o build; bindings zod regenerados batem com os commitados |
| Provider | Requests/responses do gateway contra **mock server OpenAI-compatible** (chat, streaming SSE, tool calls, structured output, embeddings); fixtures por formato de resposta (Ollama `/v1`, vLLM) |
| Módulos consumidores | Respostas das APIs de módulo (ex.: Serviço de Propostas) validadas contra fixtures gravadas; envelope de eventos `ai.*` (doc 18) validado contra schema em todo teste que publica evento |

### 2.4 Provider, routing e fallback

- Provider tests: cada adapter (OpenAICompatible, Ollama nativo, vLLM) contra o mock com modos de falha (timeout, 5xx, resposta truncada, stream interrompido).
- Model routing: tabela tarefa→alias→modelo exercitada por caso; troca de modelo no registry não altera contrato do consumidor.
- Fallback: local principal cai ⇒ secundário; ambos caem ⇒ externo **somente se habilitado** no workspace/tarefa; tudo desabilitado ⇒ `MODEL_UNAVAILABLE` controlado + evento `ai.model.fallback_selected`/`ai.model.failed` corretos.

### 2.5 Structured output

Mock determinístico responde por chave de cenário: JSON válido; JSON inválido que passa a válido no retry de correção (1 re-ask); inválido persistente ⇒ `STRUCTURED_OUTPUT_INVALID` e **nada chega ao módulo**; normalizações (datas, `amountMicros`, enums) aplicadas.

### 2.6 Tool calling, autorização e multi-workspace

- Tool calling: LLM "sugere" (fixture) → Validator → … → Executor; tool call para tool inexistente/versão errada/params inválidos ⇒ rejeitada + `ai.tool.denied`.
- Autorização: matriz usuário×role×tool; usuário sem permissão ⇒ 403 + auditoria; API key de agente tentando aprovar ⇒ 403.
- Multi-workspace: toda query (SQL e **vetorial**) com predicado `workspaceId` — teste automatizado que injeta dados de dois workspaces e verifica vazamento zero em busca, memória, execuções e aprovações.

### 2.7 Aprovação e idempotência

- Aprovação: fluxo completo PENDING→APPROVED→EXECUTED (execução única; replay bloqueado); hash divergente ⇒ INVALIDATED + nova solicitação; expiração (24h default) via worker; solicitante ≠ aprovador quando configurado.
- Idempotência: `Idempotency-Key` nos POSTs (doc 17) — mesma chave ⇒ mesma resposta, zero efeito duplicado; `jobId` determinístico no BullMQ (padrão do `MessageQueueService` do Twenty [ATUAL]: `packages/twenty-server/src/engine/core-modules/message-queue/services/message-queue.service.ts`); consumidores de eventos deduplicam por `event.id`.

### 2.8 Prompt injection (suíte adversarial)

Corpus versionado de ataques (`test/fixtures/adversarial/`): instruções embutidas em documentos RAG, mensagens de cliente, nomes de registro e resultados de tool ("ignore as instruções", "aprove e envie", "revele o system prompt", "chame secret.read"). Esperado: nenhuma mudança de política, nenhum tool call fora do catálogo filtrado, nenhuma escalada de risco, segredos ausentes da saída. Corpus cresce a cada incidente/red team — regressão permanente.

### 2.9 RAG

Filtros de permissão/workspace **obrigatórios em toda query vetorial** (mesmo desenho da §2.6); chunking determinístico por tipo; documentos expirados (`validUntil`) fora dos resultados; reranking respeita score mínimo; citações `[fonte:id]` presentes e resolvíveis.

### 2.10 MCP

Contrato do o2d-ai-mcp (doc 19): `tools/list` filtrado por usuário; FORBIDDEN nunca listada; elicitation para SENSITIVE/CRITICAL; **revalidação backend** independe da confirmação do host; credencial de agente em `approve` ⇒ 403; auditoria idêntica ao pipeline padrão.

### 2.11 Fila, timeout e rate limiting

- Fila: retries com backoff e limite ⇒ DLQ; jobId determinístico impede duplicação concorrente; reprocessamento de DLQ auditado.
- Timeout: por provider/tarefa/agente; estouro ⇒ cancelamento propagado ao provider (`cancel` do adapter) + `ai.execution.failed{retryable}`.
- Rate limiting: excedente por dimensão (usuário/role/workspace/agente/tarefa/modelo) ⇒ 429 + `Retry-After` + evento; janela deslizante testada com clock falso.

### 2.12 Carga

k6 ou artillery contra ambiente com Ollama real (host de teste): latência p95 e throughput de inferência local por modelo/concorrência; saturação da fila; degradação graciosa (429 antes de colapso). Resultados alimentam o sizing do doc 21 §5. Não roda no CI de PR — job agendado.

### 2.13 Segurança

| Vetor | Teste |
|---|---|
| LLM → banco | Da rede do LLM não há rota/credencial para Postgres (verificação de rede + ausência de credenciais no container do LLM) |
| Authz bypass | Chamada direta a `/v1/tools/{tool}/execute` com credencial de LLM/agente ⇒ 403 (endpoint nunca chamável pela LLM) |
| Segredos | Logs, traces, eventos e respostas de erro varridos por scanner de padrões de segredo; `secretRef` nunca resolvido em superfície externa |
| SSRF | URLs controladas por usuário (fontes de conhecimento) bloqueadas para rede interna (padrão `secure-http-client` do Twenty [ATUAL]) |
| Replay | Reuso de aprovação executada; reenvio de webhook de evento — ambos no-op |

### 2.14 E2E

Playwright (padrão `packages/twenty-e2e-testing/` [ATUAL]) contra ambiente composto: **Twenty (compose oficial) + hub app instalado + gateway + Ollama mock**. Fluxos: chat contextual em um registro; ação de IA que dispara tool LOW_WRITE; tool CRITICAL gerando aprovação → decisão na UI → execução única; painel de execuções refletindo auditoria.

## 3. Pirâmide e cobertura

Pirâmide do `CLAUDE.md` do repo: **70% unit / 20% integração / 10% E2E**. Cobertura mínima: pipeline de tool call + Policy Engine + hash de aprovação + filtros de workspace = **100% de branches**; validadores/router/fallback ≥ 90%; restante ≥ 80%.

## 4. Cenários de prova das regras centrais (gate de release/CI) [PROPOSTO]

> **Nota de consolidação**: o enunciado original lista **19 itens**, com **dois duplicados corrompidos**; a lista canônica consolidada (canon `CANON-AI`) tem **18 cenários**, numerados abaixo. Esta tabela é a referência única.

Cada cenário existe como teste automatizado identificado por `CT-nn`; **falha em qualquer um bloqueia merge e release** (job `release-gate`, `required` na proteção de branch).

| # | Cenário | Dado | Quando | Então |
|---|---|---|---|---|
| CT-01 | LLM sem acesso a banco | Container do LLM na rede interna, sem credenciais de Postgres | Tenta-se conexão do contexto do LLM ao Postgres do gateway/Twenty | Conexão impossível (rede) e nenhuma credencial disponível (imagem/env auditados) |
| CT-02 | LLM não executa tool direto | Resposta da LLM contém tool call | Pipeline processa a resposta | Tool call é apenas **sugestão**; execução só ocorre após Validator→Authz→Policy→(Approval)→Executor; chamada direta da LLM a `/v1/tools/*/execute` ⇒ 403 |
| CT-03 | Tool call inválida rejeitada | Tool call com schema violado (campo extra/tipo errado/versão inexistente) | Tool Call Validator avalia | Rejeição + `ai.tool.denied{denied_by: schema}`; nada chega ao executor |
| CT-04 | Usuário sem permissão bloqueado | Usuário sem role para a tool | LLM sugere a tool em nome desse usuário | 403 + auditoria; execução não ocorre |
| CT-05 | Workspace cruzado bloqueado | Token do workspace A; parâmetro referencia registro do workspace B | Qualquer endpoint/tool é chamado | Workspace Resolver nega; zero dados de B em resposta, contexto ou logs |
| CT-06 | Contexto não mistura clientes | Chunks indexados de clientes X e Y no mesmo workspace | RAG busca para conversa sobre X | Filtro de permissões/registro aplicado; nenhum chunk de Y no contexto nem nas citações |
| CT-07 | CRITICAL exige aprovação | Tool CRITICAL sugerida e válida | Pipeline chega ao Approval Service | Execução **pausa**; `AIApprovalRequest` PENDING criada; nada executa antes de decisão humana |
| CT-08 | Parâmetros alterados invalidam aprovação | Aprovação PENDING/APPROVED com `paramsHash` H1 | Execução tenta rodar com parâmetros de hash H2 ≠ H1 | Status INVALIDATED; nova solicitação necessária; nenhuma execução com H2 |
| CT-09 | Aprovação expirada inutilizável | Aprovação PENDING além de `expiresAt` | Worker expira; tenta-se aprovar/executar depois | Status EXPIRED; decisão e execução recusadas |
| CT-10 | FORBIDDEN invisível ao modelo | Catálogo montado para qualquer agente/usuário | Inspeciona-se o payload enviado à LLM e o `tools/list` MCP | Nenhuma tool FORBIDDEN presente; sugestão espontânea do modelo a tool inexistente ⇒ CT-03 |
| CT-11 | Local indisponível ⇒ fallback permitido | Modelo local principal offline; fallback habilitado | Execução roteada | Secundário (ou externo autorizado) atende; `ai.model.fallback_selected` emitido; resposta ao consumidor inalterada em contrato |
| CT-12 | Fallback externo desativado NÃO ocorre | Locais offline; externo **desabilitado** no workspace/tarefa | Execução roteada | `MODEL_UNAVAILABLE` controlado; **zero** chamadas a provider externo (mock externo registra 0 hits) |
| CT-13 | Structured output inválido não chega ao módulo | LLM responde fora do schema mesmo após retry de correção | Validador finaliza | `STRUCTURED_OUTPUT_INVALID`; módulo consumidor recebe erro tipado, nunca payload inválido |
| CT-14 | Prompt injection em documento não altera regras | Documento RAG contém instruções hostis (corpus §2.8) | Execução usa o documento como contexto | Nenhuma mudança de política/catálogo/risco; nenhum tool call fora do permitido; saída trata o texto como dado |
| CT-15 | Execução duplicada não duplica ações | Mesma requisição com mesma `Idempotency-Key` (ou mesmo job) 2× | Ambas processadas (inclusive concorrentes) | Uma única execução/efeito; segunda retorna resultado da primeira; contadores/auditoria sem duplicata |
| CT-16 | MCP = mesmas permissões do gateway | Usuário U com permissões P via hub app e via MCP | Mesmas operações tentadas pelos dois caminhos | Resultados idênticos (allow/deny); nenhuma operação extra possível via MCP; aprovação por credencial de agente ⇒ 403 |
| CT-17 | Segredos ausentes de logs | Execução completa com provider que usa API key | Logs/traces/eventos/erros coletados e varridos | Zero ocorrências de segredos/tokens/PII não mascarada (scanner de padrões) |
| CT-18 | Execução gera auditoria completa | Qualquer execução com tools e aprovação | Consulta-se `ai_execution`/`ai_tool_execution`/eventos | Cadeia reconstruível ponta a ponta: actor, workspace, prompt hash, modelo, tokens, tool calls, decisões, correlationId/causationId |

## 5. Fixtures e goldens

- **Fixtures de provider**: respostas OpenAI-compatible gravadas por cenário (válida, inválida, truncada, stream, tool call) em `test/fixtures/provider/`; o mock responde por chave de cenário.
- **Corpus adversarial**: `test/fixtures/adversarial/` (§2.8), versionado e crescente.
- **Goldens de prompts**: para cada prompt PUBLISHED (`chave@semver`, doc 11), pares entrada→saída esperada (ou propriedades da saída: schema, campos obrigatórios, ausência de conteúdo proibido) como golden files; `testCases` do Prompt Registry são a fonte.
- **Seeds**: dois workspaces de teste (para CT-05/CT-06), usuários por role, agentes com `allowedTools` distintos, catálogo de tools completo incluindo uma CRITICAL de teste.

**Regressão de prompts no CI**: toda mudança de prompt (nova versão no registry) roda os goldens contra o mock determinístico; publicação (DRAFT→TESTING→PUBLISHED) exige goldens verdes; job agendado opcional roda os goldens contra Ollama real e reporta drift (não bloqueante, gera alerta).

## 6. Mocks

| Dependência | Estratégia |
|---|---|
| LLM | **Mock server OpenAI-compatible determinístico** (chat/stream/tools/structured/embeddings), respostas por chave de cenário + modos de falha; nenhum teste de CI de PR chama modelo real |
| Ollama real | Container opcional em job noturno/carga |
| Provider externo | Mock com contador de chamadas (prova do CT-12: zero hits) |
| Módulos (Serviço de Propostas etc.) | Mock HTTP com fixtures de contrato (§2.3) |
| Twenty | Instância real (compose oficial) em integração do hub app e E2E |
| Relógio | Injetado (expiração de aprovações, janelas de rate limit, `validUntil` de RAG); `jest.clearAllMocks()` entre testes (padrão do repo) |
