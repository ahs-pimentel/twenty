# 02 — Mapa de Impacto

> Classificação: **reutilizar · estender · desacoplar · substituir · criar do zero · manter sem alteração**, com prioridade (Obrigatória MVP / Recomendada / Evolução futura / Dívida técnica / Não necessária).
> Decisão estruturante (detalhe em `04-target-architecture.md`): **nenhum arquivo do core do Twenty é alterado e não há fork**. A plataforma = App `o2d-ai-hub` + serviços proprietários externos (`o2d-ai-gateway`, `o2d-ai-contracts`, `o2d-ai-mcp`) em repositórios próprios da óDois.

## 1. Mantidos sem alteração (core do Twenty)

Todo o repositório Twenty permanece intocado. Em particular, o **subsistema de IA nativo** (`engine/metadata-modules/ai/`, `core-modules/tool-provider/`, `api/mcp/`) **não é alterado nem estendido**: ele continua disponível para uso genérico do CRM, mas a plataforma óDois não depende dele (regra 17) e pode operá-lo desabilitado por workspace.

## 2. Reutilizados sem alteração

| Componente | Caminho | Uso pela plataforma | Prioridade | Risco |
|---|---|---|---|---|
| Plataforma de Apps (SDK, manifest, CLI, sandbox) | `packages/twenty-sdk/`, `packages/twenty-front-component-renderer/`, `engine/core-modules/application/` | Base do `o2d-ai-hub-app` (UI de chat, ações, administração, aprovações) | **Obrigatória MVP (F2)** | Médio — SDK em evolução; fixar versão |
| REST/GraphQL dinâmicos + client tipado | `engine/api/`, `packages/twenty-client-sdk/` | Tools `crm.*` do gateway leem/escrevem CRM com permissões do usuário (on-behalf-of via API key restrita + verificação de role) | **Obrigatória MVP (F3)** | Baixo |
| RBAC + permissionFlags | `engine/metadata-modules/{role,object-permission,permission-flag}/` | Roles do hub app (`ai-user`, `ai-approver`, `ai-admin`); resolução de permissões do usuário iniciador | **Obrigatória MVP** | Baixo |
| API keys | `engine/core-modules/api-key/` | Credencial do gateway para o Twenty (escopo mínimo) | **Obrigatória MVP** | Baixo |
| Logic functions (httpRoute) | `engine/{metadata-modules,core-modules}/logic-function/` | Proxies finos hub app → gateway com actor propagado | **Obrigatória MVP (F2)** | Médio (driver LOCAL/LAMBDA conforme hospedagem) |
| Webhooks de saída HMAC | `engine/metadata-modules/webhook/` | Notificar o gateway de mudanças relevantes no CRM (invalidação de contexto/índices RAG) | Recomendada (F6) | Baixo |
| Workflows (`AI_AGENT`, webhook trigger) | `modules/workflow/` | Automações opcionais (ex.: acionar resumo ao fechar oportunidade) | Evolução futura | Baixo |
| MCP nativo do Twenty | `engine/api/mcp/` | CRUD genérico de CRM para hosts MCP; **não** recebe as tools o2d.* | Mantido | Baixo |
| E-mails | `packages/twenty-emails/`, `core-modules/email/` | Notificação de aprovação pendente (complemento) | Recomendada (F4) | Baixo |

## 3. Padrões espelhados (reimplementados no gateway, sem copiar código AGPL)

| Padrão | Referência no repo | Aplicação no gateway | Prioridade |
|---|---|---|---|
| Multi-provider via Vercel AI SDK incl. openai-compatible | `ai-models/services/sdk-provider-factory.service.ts` | ProviderAdapter próprio (deps npm próprias) — `07-provider-and-model-registry.md` | **Obrigatória MVP (F1)** |
| Config de providers com refs de segredo | `ai-models/services/provider-config.service.ts` | `ai_provider.secretRef` + anti-exfiltração | **Obrigatória MVP (F1)** |
| BullMQ + worker + crons + locks | `core-modules/message-queue/`, `src/queue-worker/`, `cache-lock/` | Filas do gateway (execuções, indexação, expirações) | **Obrigatória MVP (F1)** |
| JWTs tipados + guards | `core-modules/auth/` | Auth do gateway (JWT de serviço com actor; S2S) | **Obrigatória MVP (F1)** |
| Tool registry + executor com permissões | `core-modules/tool-provider/`, `permissions.service.ts` | Tool Registry com **níveis de risco e aprovação** (o que falta no nativo) | **Obrigatória (F3)** |
| Billing/uso de IA | `metadata-modules/ai/ai-billing/` | Usage Service + limites por workspace/tarefa | Recomendada (F8) |
| Outbox de eventos com correlation | `workspace-event-emitter/` + `event-logs/` | Eventos `ai.*` com outbox transacional | **Obrigatória (F3)** |
| OAuth 2.1 para MCP | `api/mcp/guards/mcp-auth.guard.ts` | Auth do `o2d-ai-mcp` | Evolução (F7) |
| Storage assinado | `file-storage/`, `file/file-url/` | Artefatos/documentos da base de conhecimento | Recomendada (F6) |

## 4. Criados do zero (proprietários óDois — repositórios próprios)

| Componente | Repositório | Responsabilidade | Prioridade | Dependências | Risco |
|---|---|---|---|---|---|
| `o2d-ai-gateway` | `o2d-ai-gateway/` | 22 componentes internos (`05-ai-gateway-spec.md`); único caminho para LLMs | **Obrigatória MVP (F1)** | Postgres+pgvector, Redis, Ollama/vLLM | Núcleo do valor |
| `o2d-ai-contracts` | `o2d-ai-contracts/` | JSON Schemas versionados + bindings zod (Pydantic opcional) | **Obrigatória MVP (F1)** | — | Governança de versões |
| `o2d-ai-hub-app` | `o2d-ai-hub-app/` | App Twenty (UI + proxies) | **Obrigatória (F2)** | twenty-sdk, gateway | Breaking changes SDK |
| `o2d-ai-mcp` | `o2d-ai-mcp/` (ou módulo do gateway) | MCP para Claude/Codex com mesma authz | Evolução (F7) | gateway estável | Governança de agentes |
| Infra local de LLM | compose próprio óDois | Ollama (dev/prod pequena), vLLM (prod GPU), pgvector, MinIO | **Obrigatória MVP (F1)** | hardware/GPU | Sizing/custos |
| Base RAG + memória | dentro do gateway | pgvector, ingestão, filtros de permissão | Evolução (F6) | F1-F3 | Vazamento se mal filtrado — testes obrigatórios |

## 5. Desacoplamentos deliberados

| Desacoplamento | Justificativa | Prioridade |
|---|---|---|
| Consumidores ↔ providers de modelo (roteamento por **tarefa**) | Trocar modelo/engine sem tocar consumidores (fluxo 40 do doc 03); evita acoplamento a um único modelo/provedor | **Obrigatória MVP** |
| Gateway fora do processo do Twenty | AGPL; ciclo de release próprio; regra 18 (lógica crítica sob controle óDois); regra 17 (não depender da IA experimental do Twenty) | **Obrigatória MVP** |
| Prompts fora do código (Prompt Registry) | Regra 12; evita prompts espalhados (dívida já visível no próprio Twenty: `agent-system-prompts.const.ts`) | **Obrigatória (F5)** |
| LLM ↔ execução de ações (pipeline sugerir→validar→aprovar→executar) | Regras 1–8; a LLM nunca tem credencial de banco nem endpoint de módulo | **Obrigatória MVP** |
| Módulo de propostas ↔ AI SDK direto | O Serviço de Propostas (spec irmã, `docs/specs/proposal-module/08-llm-spec.md`) previa chamada direta ao AI SDK no worker; com a plataforma, passa a chamar o gateway (`/v1/extract`, `/v1/generate`) — **nota de compatibilidade**: contratos de saída idênticos, mudança confinada ao adaptador LLM do worker | Recomendada (a partir da F1) |

## 6. Alterações/substituições no core do Twenty e fork

**Nenhuma alteração; fork avaliado e rejeitado.**

| Hipótese | Por que rejeitada |
|---|---|
| Fork do Twenty para embutir o gateway | Rebase permanente a cada release; AGPL: operar fork em rede obriga a disponibilizar o fonte modificado; tudo que o hub precisa existe via Apps (objetos, UI, ações, permissões) — tabela detalhada "se um dia for necessário" em `06-twenty-app-spec.md` |
| Estender o subsistema `ai/` nativo (PRs internos) para virar o gateway | Área alpha em evolução rápida; regra 17 proíbe dependência exclusiva; lógica crítica ficaria fora do controle óDois (regra 18). Caminho legítimo: contribuições upstream pontuais, sem colocar o roadmap óDois na dependência delas |
| Usar o MCP nativo do Twenty como MCP da plataforma | Authz do MCP nativo cobre tools genéricas do CRM; as tools o2d.* exigem o pipeline de risco/aprovação do gateway — camada paralela de autorização é proibida pelo enunciado (Etapa 19), logo o MCP o2d vive no gateway |
| Guardar execuções/aprovações como objetos Twenty | Dados de auditoria exigem append-only e volume alto; objetos CRM são mutáveis e sincronizados por metadata — fonte da verdade fica no Postgres do gateway (`16-data-model.md`) |

## 7. Riscos mapeados (Etapa 2 do enunciado) e resposta do desenho

| Risco | Resposta |
|---|---|
| Acoplamento ao Twenty | Hub app usa só APIs públicas do SDK; gateway conversa com Twenty por REST/GraphQL versionados; contratos próprios em `o2d-ai-contracts` |
| Acoplamento a um único modelo | Roteamento por tarefa + aliases; registry de modelos com capacidades |
| Acoplamento a um único provedor | ProviderAdapter; OpenAI-compatible como denominador comum; fallback configurável |
| Prompts espalhados pelo código | Prompt Registry versionado (regra 12); lint de CI no gateway proibindo prompt inline |
| Chamadas diretas a modelos | Proibição arquitetural + rede: só o gateway alcança os endpoints de inferência (`21-infrastructure.md`) |
| Acesso direto da LLM ao banco | LLM não possui credenciais; tools passam pelo Tool Executor; teste obrigatório 1 (`22-test-strategy.md`) |
| Ferramentas sem autorização | Catálogo filtrado por agente+usuário+workspace antes do modelo; validação dupla na execução |
| Vazamento entre workspaces | workspaceId em token + toda query (incl. vetorial); testes 5–6 |
| Ausência de idempotência | `Idempotency-Key` + chaves naturais + outbox; teste 15 |
| Falta de rastreabilidade | `ai_execution`/`ai_tool_execution`/eventos com correlation/causation; teste 18 |
| Ausência de aprovação humana | Approval Service (F4) com hash de parâmetros; testes 7–9 |
| Dependência de funcionalidades alpha | Regra 17: IA nativa do Twenty não é dependência; só plataforma de Apps (GA) e APIs públicas |
| Execução insegura de Logic Functions | Logic functions do hub são proxies finos sem segredo de provider; segredos só no gateway; sandbox do Twenty (`logic-function-drivers/`) permanece com escopo mínimo |

## 8. Resumo por prioridade

- **Obrigatórias MVP (F1–F2)**: gateway mínimo (OpenAI-compatible→Ollama/vLLM, chat, structured output, auth, logs), contracts v1, infra local, hub app básico (painel, chat contextual, execuções).
- **Obrigatórias sequência (F3–F4)**: Tool Registry com riscos + tools CRM/propostas; aprovação humana completa.
- **Recomendadas**: webhook Twenty→gateway p/ invalidação de contexto; migração do Serviço de Propostas para o gateway; notificações por e-mail de aprovação.
- **Evolução futura**: Prompt/Agent Registry (F5), RAG/memória (F6), MCP (F7), GPU/escala/custos (F8), workflows com IA.
- **Dívida técnica registrada (do repo, não nossa)**: prompts em constantes no core; IA nativa sem aprovação/limites — motivo adicional da regra 17.
- **Não necessárias**: fork; alterações no core; FastAPI/Celery/n8n/Kafka (inexistentes no repo; BullMQ cobre — decisão de linguagem em `24-open-questions.md`).
