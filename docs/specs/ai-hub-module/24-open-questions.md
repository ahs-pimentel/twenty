# 24 — Questões Abertas e Decisões Pendentes

> Nada abaixo está decidido. Sugestões desta especificação **não** são decisões aprovadas; cada linha indica decisor e o que bloqueia.

## 1. Decisões técnicas

| # | Questão | Opções e recomendação preliminar | Decisor | Bloqueia |
|---|---|---|---|---|
| T1 | **Linguagem do o2d-ai-gateway** | (a) NestJS/TypeScript — paridade total com o repo (AI SDK v6 já cobre openai-compatible/streaming/tools; BullMQ; zod; client-sdk tipado); (b) FastAPI/Python — ecossistema de IA (Pydantic, instructor, LiteLLM) porém stack nova para o time e zero Python no repo. Recomendação: (a); contratos JSON Schema mantêm (b) possível depois | Eng. óDois | **F1** |
| T2 | Engine local inicial e modelos concretos por alias | Ollama (dev/prod pequena) vs vLLM desde já; escolha dos modelos (extração, redação, embeddings, reranker) com validação de qualidade pt-BR e VRAM disponível — exemplos citados nos docs 07/21 são **estimativas, não decisões** | Eng. óDois | F1 |
| T3 | Hardware/hospedagem da inferência | GPU própria (qual VRAM?) vs CPU-only no início vs cloud GPU; co-locação com o gateway | Infra óDois | F1 |
| T4 | ORM/migrations do gateway | TypeORM (paridade) vs Drizzle/Prisma | Eng. óDois | F1 (baixo) |
| T5 | LiteLLM como camada adicional | Provavelmente desnecessário (ProviderAdapter próprio cobre); reconsiderar apenas se multiplicarem providers externos | Eng. óDois | — |
| T6 | Streaming no sandbox de front components | Spike na F2: SSE/incremental render dentro do `twenty-front-component-renderer`; fallback: polling de chunks (padrão catch-up) | Eng. óDois | F2 (UX) |
| T7 | Twenty cloud vs self-hosted para o workspace óDois | Self-hosted dá controle de versão/upgrade (recomendado — mesmo racional da spec irmã `docs/specs/proposal-module/15-open-questions.md` T9) | Infra óDois | F2 |
| T8 | Objeto `aiApprovalNotification` no Twenty | Criar só se e-mail+painel forem insuficientes para SLA de aprovação (16-data-model.md §4) | Eng./Comercial | F4 |
| T9 | Auth do o2d-ai-mcp | OAuth 2.1 (padrão do MCP do Twenty) vs API key por usuário; hosts suportados na F7 | Eng. óDois | F7 |
| T10 | Secret manager | env cifrado vs Vault/Infisical/SOPS; política de rotação | Infra óDois | F1 |
| T11 | Embeddings: modelo e dimensionalidade | Define schema do pgvector (dimensão fixa por índice); trocar modelo ⇒ reindexação — decidir antes da F6 | Eng. óDois | F6 |
| T12 | n8n | Não existe no repo e não é necessário (BullMQ + workflows do Twenty cobrem); só entra se a óDois já o operar | Eng. óDois | — |
| T13 | Migração do Serviço de Propostas para o gateway | Momento (junto da F1 ou após F3, quando as tools proposal.* existirem); contrato de compatibilidade | Eng. óDois | Coordenação entre roadmaps |
| T14 | GitLab como fonte de conhecimento | Só se a óDois usar GitLab (não há evidência no repo); conector é da F6+ | Eng. óDois | F6 |

## 2. Decisões de negócio

| # | Questão | Observações | Decisor | Bloqueia |
|---|---|---|---|---|
| N1 | Política de fallback externo default | Recomendação: **off** por padrão em todos os workspaces; habilitação explícita por workspace+tarefa | Direção | F1 |
| N2 | Quais tarefas são "dados sensíveis local-only" | Ex.: finance.*, dados de contrato; define `allowsSensitiveData` | Direção/DPO | F1 |
| N3 | Quem recebe role `ai-approver` e SLA de aprovação | Também: solicitante pode aprovar a própria ação? (recomendação: não para CRITICAL) | Direção | F4 |
| N4 | Limites de uso por usuário/workspace e orçamento de custo | Tokens/dia, custo/mês; ação ao estourar (throttle vs bloqueio) | Direção/Financeiro | F8 (básico na F1) |
| N5 | Expiração default de aprovações | Sugerido 24h; por tool | Direção | F4 |
| N6 | Retenção de conversas/execuções (LGPD) | Sugerido 12 meses para payloads; agregados mantidos | Jurídico/DPO | F1 |
| N7 | Catálogo inicial de agentes e tom de voz | Quais dos 9 agentes entram primeiro; persona/idioma | Comercial | F5 |
| N8 | Envio de dados a providers externos (quando habilitados) | DPA, não-treinamento, mascaramento de PII | Jurídico/DPO | antes de qualquer opt-in externo |

## 3. Questões jurídicas/licenciamento

| # | Questão | Observações | Decisor |
|---|---|---|---|
| J1 | Qualificação AGPL do hub app e uso dos pacotes `twenty-sdk`/`twenty-client-sdk` | Mesma questão da spec irmã (`proposal-module/15-open-questions.md` J1) — uma única revisão jurídica cobre ambas | Jurídico óDois |
| J2 | Licenças dos modelos locais (Llama/Qwen/Mistral etc.) para uso comercial | Verificar licença de cada modelo escolhido em T2 | Jurídico |
| J3 | LGPD: prompts/outputs como dados pessoais | Retenção, anonimização, direito de exclusão vs trilha de auditoria (ponderação como na spec irmã) | Jurídico/DPO |

## 4. Conflitos com padrões existentes (registrados)

| Conflito | Tratamento |
|---|---|
| Enunciado sugere FastAPI/Pydantic/Celery; repo é 100% TypeScript/BullMQ | T1 aberto; specs escritas de forma neutra (JSON Schema como fonte dos contratos); recomendação NestJS com evidências (`00` §4) |
| Enunciado cita n8n, GitLab, AgentMemory, Prometheus como possíveis existentes | Verificado: **nenhum existe no repo** (`01` §4); tratados como novos/opcionais (T12, T14) |
| Twenty já tem IA nativa (agentes/chat/tools/MCP) que se sobrepõe parcialmente ao hub | Regra 17 aplicada: convivência sem dependência — nativa pode ficar desabilitada; risco de confusão de UX para o usuário final (dois chats) registrado — mitigação: desabilitar chat nativo nos workspaces óDois (decisão junto com T7) |
| Enunciado do teste 12/13 (Etapa 23) contém texto corrompido/duplicado | Consolidado nos 18 cenários canônicos (`22-test-strategy.md`) com nota |
| Spec irmã (módulo de propostas) previa chamada direta ao AI SDK no worker | Compatibilizado: migração para o gateway como consumidor (T13; `02-impact-map.md` §5) |

## 5. Riscos em aberto (acompanhamento)

- **Qualidade/latência de modelos locais em pt-BR** para redação comercial — piloto com métricas antes de expandir tarefas (T2/T3).
- **Evolução rápida da plataforma de Apps e da IA nativa do Twenty** — versão fixada + workspace de homologação; upside: novos pontos de extensão podem simplificar o hub.
- **Complexidade operacional** (GPU, vLLM, observabilidade) para um time pequeno — faseamento F1→F8 existe exatamente para isso; F1 roda em uma máquina.
- **Escopo do RAG** (permissões por documento) — é a parte mais fácil de vazar dados; testes 5/6/14 são bloqueantes e a F6 não entra sem eles.
