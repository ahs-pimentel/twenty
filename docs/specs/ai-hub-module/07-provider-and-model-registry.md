# 07 — Provider Registry e Model Registry

> Plataforma o2d-ai-platform · componente: **o2d-ai-gateway** (Provider Registry + Model Registry + Health Check Service).
> Status: especificação — **nada aqui está implementado**. Marcações: **[ATUAL]** = existe no repositório Twenty (caminhos reais); **[PROPOSTO]** = arquitetura da plataforma óDois.
> Dúvidas em aberto → doc 24. Canon: `CANON-AI`.

## 1. Estado atual do Twenty [ATUAL]

O Twenty já resolve o problema "muitos provedores, uma interface" com o Vercel AI SDK. A plataforma óDois **reimplementa esse padrão fora do Twenty** — o gateway não reutiliza código AGPL do core; reusa o **conceito** e o AI SDK como dependência npm do próprio gateway.

| O que existe | Onde (caminho real) | Observação |
|---|---|---|
| Factory de providers do AI SDK com **8 pacotes** | `packages/twenty-server/src/engine/metadata-modules/ai/ai-models/services/sdk-provider-factory.service.ts` | `@ai-sdk/openai`, `anthropic`, `google`, `mistral`, `xai`, `amazon-bedrock`, `azure` e **`@ai-sdk/openai-compatible`** (`createOpenAICompatible` com `baseUrl` obrigatório) |
| Constantes de pacotes SDK | `packages/twenty-server/src/engine/metadata-modules/ai/ai-models/constants/ai-sdk-package.const.ts` | — |
| Catálogo declarativo de providers/modelos | `packages/twenty-server/src/engine/metadata-modules/ai/ai-models/ai-providers.json` | openai/anthropic/google/mistral/xai; custos, `contextWindow`, modalities |
| Providers custom **por instância** | `packages/twenty-server/src/engine/metadata-modules/ai/ai-models/services/provider-config.service.ts` | Merge do catálogo committed com a config variable `AI_PROVIDERS`; templates `{{VAR}}` resolvidos via `TwentyConfigService` **apenas para providers do catálogo, nunca para custom** (anti-exfiltração de segredos) |
| Chaves LLM em config | `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` | Grupo LLM: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`, `AI_MODELS_DEFAULT_FAST/SMART/RECOMMENDED/DISABLED` |

Limitações relevantes para a óDois [ATUAL]:

- Providers custom são **por instância**, não por workspace, e sem UI CRUD dedicada.
- Não há registro de modelos com aliases de tarefa, flags de capacidade granulares, health check por modelo, nem política de dados sensíveis.
- Zero ocorrências de Ollama/vLLM/llama.cpp/LiteLLM no repositório (grep confirmado).
- Regra 17 do enunciado: a IA nativa do Twenty **não** é o motor da plataforma — pode ficar desabilitada.

## 2. Posição na arquitetura [PROPOSTO]

O **Provider Registry** e o **Model Registry** vivem no gateway (Postgres do gateway, doc 16). Invariante central: consumidores (Twenty hub app, Serviço de Propostas, MCP) **nunca conhecem providers nem adapters** — só tarefas/aliases (doc 08). Trocar provider ou modelo não altera consumidor algum.

```
Módulo proprietário ──► o2d-ai-gateway ──► ProviderAdapter ──► Ollama / vLLM / llama.cpp / (OpenAI/Anthropic opt-in)
Twenty (hub app)   ──► o2d-ai-gateway ──► idem
```

## 3. Abstração `ProviderAdapter` [PROPOSTO]

Contrato comum que todo adapter implementa. Assinaturas **ilustrativas** (TypeScript, gateway NestJS — decisão 2 do canon; contratos reais em `o2d-ai-contracts`, language-neutral):

```typescript
type ProviderAdapter = {
  readonly providerId: string;

  // Descoberta
  listModels(): Promise<ProviderModelInfo[]>;

  // Inferência
  chatCompletion(request: ChatRequest, options: CallOptions): Promise<ChatResult>;
  responses(request: ResponsesRequest, options: CallOptions): Promise<ResponsesResult>;
  structuredOutput<TSchema>(request: StructuredRequest<TSchema>, options: CallOptions): Promise<StructuredResult<TSchema>>;
  toolCalling(request: ToolCallingRequest, options: CallOptions): Promise<ToolCallingResult>;

  // Modalidades auxiliares
  embeddings(request: EmbeddingsRequest, options: CallOptions): Promise<EmbeddingsResult>;
  rerank(request: RerankRequest, options: CallOptions): Promise<RerankResult>;
  vision(request: VisionRequest, options: CallOptions): Promise<ChatResult>;
  audio(request: AudioRequest, options: CallOptions): Promise<AudioResult>;

  // Streaming (SSE em POST /v1/chat, doc 17)
  streamChatCompletion(request: ChatRequest, options: CallOptions): AsyncIterable<ChatStreamChunk>;

  // Operação
  healthCheck(): Promise<ProviderHealth>;   // alimenta ai.provider.online/offline
  cancel(executionRef: string): Promise<void>;
};

type CallOptions = {
  timeoutMs: number;          // do ai_model, com teto por request
  abortSignal?: AbortSignal;  // cancelamento cooperativo (POST /v1/executions/{id}/cancel)
  correlationId: string;
};
```

Regras:

- Capacidade não suportada pelo adapter/modelo ⇒ erro tipado `CAPABILITY_NOT_SUPPORTED` **antes** de chamar o provedor (o Model Router já deve ter filtrado; isto é defesa em profundidade).
- Todo método respeita `timeoutMs` e `abortSignal`; estouro gera `ai.model.failed` e aciona o Fallback Service (doc 08).
- Adapters não conhecem workspace, usuário, tools nem prompts — recebem requests já montados pelo pipeline.

## 4. Adapters [PROPOSTO]

### 4.1 `OpenAICompatibleProvider` — principal

Cobre qualquer servidor que exponha API OpenAI-compatible: **Ollama (`/v1`), vLLM, llama.cpp server, LiteLLM (opcional)**. É o análogo proprietário do que o Twenty faz com `@ai-sdk/openai-compatible` [ATUAL]. Diferenças práticas que o adapter e o Model Registry precisam refletir (suporte varia por servidor **e** por modelo):

| Servidor | Tool calling | Structured output | Streaming | Observações práticas |
|---|---|---|---|---|
| Ollama `/v1` | Parcial — depende do modelo (template de chat com tools); paralelismo limitado | `response_format: json_schema` suportado nas versões recentes; qualidade depende do modelo | Sim (SSE) | Endpoint `/v1` é camada de compatibilidade; recursos nativos (pull, keep_alive) ficam fora dela |
| vLLM | Sim, com parsers por família de modelo (`--tool-call-parser`) | Sim — **guided decoding** (outlines/xgrammar) garante JSON válido por construção | Sim | Melhor garantia de structured output do conjunto; exige flags corretas no deploy |
| llama.cpp server | Limitado — depende de template/gramática; varia por build | Via GBNF grammar / json_schema; sem paralelismo de tools | Sim | Menor footprint; mais variação entre versões |
| LiteLLM (opcional) | Proxy — repassa capacidades do backend | Idem | Sim | Útil só como agregador; não adiciona capacidade própria |

Consequência: as **flags de capacidade são declaradas por modelo no `ai_model`** (seção 5), nunca assumidas pelo tipo de servidor.

### 4.2 Adapters complementares

| Adapter | Papel | Recursos além do OpenAI-compatible |
|---|---|---|
| `OllamaProvider` | API nativa do Ollama para **operação** | `pull` (download de modelos), `list`, `keep_alive` (retenção em memória), `num_ctx` (janela de contexto efetiva por chamada) |
| `VLLMProvider` | Recursos nativos do vLLM | Guided decoding/outlines explícito; **métricas Prometheus nativas** (tempo de GPU, fila — alimentam doc 20) |
| `LlamaCppProvider` | Recursos nativos do llama.cpp | Gramáticas GBNF, controle fino de slots |
| `OpenAIProvider` | Externo **opcional** (opt-in por workspace/tarefa) | `allowsSensitiveData=false` por padrão |
| `AnthropicProvider` | Externo **opcional** (opt-in por workspace/tarefa) | `allowsSensitiveData=false` por padrão |

Um mesmo host físico pode ter dois providers registrados (ex.: `ollama-main` via `OpenAICompatibleProvider` para inferência + `ollama-main-native` via `OllamaProvider` para operação). O Model Router só roteia inferência; adapters nativos servem administração e health.

## 5. Registro de providers (`ai_provider`) [PROPOSTO]

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `name` | uuid, text | — |
| `adapterType` | enum | `OPENAI_COMPATIBLE` \| `OLLAMA` \| `VLLM` \| `LLAMACPP` \| `OPENAI` \| `ANTHROPIC` |
| `baseUrl` | text | Obrigatório para locais |
| `secretRef` | text | **Referência** a segredo (env/vault, cifra AES-GCM — decisão 7). Nunca plaintext |
| `isLocal` | boolean | Local = rede interna óDois |
| `allowsSensitiveData` | boolean | Locais: `true`; externos: `false` por padrão. Usado pela política de sensibilidade (doc 08) |
| `status` | enum | `ACTIVE` \| `DISABLED` |
| `healthCheckIntervalSec`, `lastHealthAt`, `healthStatus` | int, timestamptz, enum | `ONLINE` \| `OFFLINE` \| `DEGRADED` |
| `workspaceId` | uuid null | `null` = global da instância; preenchido = restrito ao workspace |

## 6. Registro de modelos (`ai_model`) [PROPOSTO]

Todos os campos exigidos pelo enunciado/canon:

| Campo | Tipo | Descrição |
|---|---|---|
| `alias` | text unique | **Alias interno** consumido pelas rotas (ex.: `o2d-extraction`). Consumidores nunca veem o resto |
| `modelIdentifier` | text | Identificador real no provedor (ex.: `qwen3:14b`) |
| `providerId` | uuid fk | → `ai_provider` |
| `type` | enum | `CHAT` \| `EMBEDDING` \| `RERANKER` |
| `maxContextTokens` | int | Contexto máximo efetivo (para Ollama, coerente com `num_ctx` configurado, não só o teórico do modelo) |
| `supportsChat` / `supportsTools` / `supportsStructuredOutput` / `supportsEmbeddings` / `supportsVision` / `supportsAudio` / `supportsStreaming` | boolean | **Flags de capacidade declaradas por modelo** (seção 4.1) |
| `priority` | int | Ordenação no roteamento (menor = preferido) |
| `timeoutMs` | int | Timeout default das chamadas |
| `estimatedCostPer1kTokensMicros` | bigint | Custo estimado (locais: custo operacional aproximado; externos: preço do provedor). Micros + `currencyCode` (paridade CURRENCY do Twenty, doc 12) |
| `active` | boolean | Inativo nunca é candidato |
| `allowedWorkspaceIds` | uuid[] null | `null` = todos os workspaces |
| `allowedTasks` | text[] null | Casos de uso permitidos (ex.: `["proposal.extract"]`); `null` = qualquer tarefa cuja rota o aponte |

### 6.1 Tabela de exemplo — aliases canônicos

> **EXEMPLOS a validar em bancada (doc 24) — não são decisões aprovadas.** Modelos locais citados apenas como candidatos plausíveis.

| Alias | Tipo | Exemplo de modelo (candidato) | Provider exemplo | Capacidades-chave | Prioridade |
|---|---|---|---|---|---|
| `o2d-classification` | CHAT | `qwen3:4b` (rápido, barato) | `ollama-main` | chat, structured output | 10 |
| `o2d-extraction` | CHAT | `qwen3:14b` | `vllm-gpu` | chat, tools, structured output | 10 |
| `o2d-writing` | CHAT | `llama3.3:70b` (quantizado) ou `qwen3:32b` | `vllm-gpu` | chat, streaming | 10 |
| `o2d-long-context` | CHAT | `qwen2.5:14b-128k` | `vllm-gpu` | chat, contexto ≥ 128k | 20 |
| `o2d-vision` | CHAT | `qwen2.5-vl:7b` ou `llama3.2-vision:11b` | `ollama-main` | vision, chat | 10 |
| `o2d-embedding` | EMBEDDING | `nomic-embed-text` ou `bge-m3` | `ollama-main` | embeddings | 10 |
| `o2d-reranker` | RERANKER | `bge-reranker-v2-m3` | `vllm-gpu` | rerank | 10 |

O vínculo alias→tarefa é feito pelo `ai_model_route` (doc 08); um alias pode ter mais de uma linha `ai_model` (principal + secundário) diferenciada por `priority`.

## 7. Health checks e eventos [PROPOSTO]

- **Por provider**: worker do gateway (BullMQ) executa `healthCheck()` no intervalo configurado (ping + latência + carga quando o adapter expõe, ex.: métricas do vLLM).
- **Por modelo**: verificação leve periódica (o modelo consta em `listModels()`? responde a uma completion mínima dentro do timeout?). Modelo ausente ⇒ `DEGRADED` no nível do modelo sem derrubar o provider.
- Transições publicam **`ai.provider.online` / `ai.provider.offline`** (envelope do doc 18, outbox → BullMQ).
- O Model Router consome o estado de saúde em memória/cache Redis — nunca faz health check inline no caminho da requisição.
- Circuit breaker por provider (doc 08) usa esses estados + falhas recentes.

## 8. Administração [PROPOSTO]

CRUD de providers, modelos e verificação de saúde é feito pela UI do **o2d-ai-hub-app** (Twenty App, fase **F2** do doc 23), que chama o gateway (`GET /v1/providers`, `GET /v1/models`, endpoints administrativos autenticados com JWT de serviço + actor humano com permissão de admin de IA). O hub app **não duplica dados** (doc 16): a UI lê via API. Toda mutação administrativa é auditada (`ai_execution`/audit trail, doc 18) — inclusive troca de segredo (`secretRef`), que nunca transita nem aparece em texto puro (cenário de teste 17).
