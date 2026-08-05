# 15 — Questões Abertas e Decisões Pendentes

> Nenhum item abaixo está decidido. Sugestões desta especificação **não** são decisões aprovadas; cada linha indica quem precisa decidir e o impacto de adiar.

## 1. Decisões de negócio (óDois)

| # | Questão | Opções/observações | Decisor | Bloqueia |
|---|---|---|---|---|
| N1 | Política de auto-aprovação (responsável pode aprovar a própria versão?) | MVP sugerido: permitido com registro; F4: segregação obrigatória | Direção comercial | F1 (configuração) |
| N2 | Alçadas de aprovação (valor/desconto que exige aprovador adicional) | Tabela de alçadas por total/margem | Direção comercial | F4 |
| N3 | Validade padrão da proposta e régua de expiração | ex.: 15 dias + lembrete | Comercial | F1 |
| N4 | Formato do número da proposta | sugerido `PRO-{ano}-{seq}` | Comercial | F1 |
| N5 | Quem é notificado como "responsável interno" quando o solicitante não tem dono definido no CRM | round-robin? fila de atendimento? | Comercial | F1 |
| N6 | Textos oficiais das mensagens WhatsApp operacionais (confirmações, perguntas, envio) | templates a redigir; sem valores comerciais antes da aprovação | Comercial/Marketing | F1 |
| N7 | Política de desconto máximo sem aprovação e margens mínimas por categoria | alimenta `serviceCatalogItem.minPrice/minMarginPercent` | Comercial/Financeiro | F2 |
| N8 | Aceite do solicitante: mensagem WhatsApp basta ou exige assinatura eletrônica? | F3 registra aceite; F4 avalia e-signature (fornecedor a decidir) | Jurídico/Comercial | F3/F4 |
| N9 | Retenção de mensagens/áudios do WhatsApp (LGPD) | sugerido 12 meses; ver `09` §6 | Jurídico/DPO | F1 |
| N10 | Identidade visual do template de proposta (layout, seções obrigatórias) | insumo para `proposalTemplate` v1 | Marketing/Comercial | F1 |

## 2. Decisões técnicas

| # | Questão | Opções e recomendação preliminar | Decisor | Bloqueia |
|---|---|---|---|---|
| T1 | Renderizador de PDF no serviço | (a) `@react-pdf/renderer` — paridade com o DPA do Twenty (`packages/twenty-server/src/engine/core-modules/dpa/pdf/`), sem browser; (b) HTML+headless Chromium (Playwright já é usado em E2E) — fidelidade maior para layout rico. Recomendação preliminar: (a) no MVP; reavaliar na definição do template (N10) | Eng. óDois | F1 |
| T2 | Versão da Evolution API e contrato exato de webhook/envio (v1.x vs v2.x; nomes de eventos, HMAC disponível?) | fixar versão e congelar fixtures de payload | Eng. óDois/Infra | F1 |
| T3 | ORM do serviço | TypeORM (paridade com o repo) vs Drizzle | Eng. óDois | F1 (baixo) |
| T4 | Hospedagem do serviço e do storage | VPS próprio com MinIO vs cloud S3; proximidade com a instância Evolution | Infra óDois | F1 |
| T5 | Modelo LLM default e fallback (custo × qualidade pt-BR) e limiares de confiança | iniciar com um modelo "smart" + fallback de outro provider; calibrar limiares com dados reais do piloto | Eng. óDois | F1 (calibração contínua) |
| T6 | Provider de transcrição (F3) | Whisper API vs alternativas; custo/qualidade pt-BR | Eng. óDois | F3 |
| T7 | Viewer de PDF dentro do sandbox de front components | validar em spike na F1 se o sandbox (`packages/twenty-front-component-renderer/`) permite render de PDF (iframe/objeto); fallback: abrir URL assinada em nova aba | Eng. óDois | F1 (UX) |
| T8 | Biblioteca DOCX (F3) | ex.: `docx` npm — não existe nada no repo; decisão da fase | Eng. óDois | F3 |
| T9 | Twenty cloud ou self-hosted como ambiente alvo do workspace óDois | self-hosted dá controle de versão de upgrade (recomendado para reduzir risco de breaking change do SDK); cloud reduz operação | Infra óDois | F1 |
| T10 | n8n entra na arquitetura? | não existe no repo e não é necessário (BullMQ + workflows do Twenty cobrem); só considerar se a óDois já operar n8n para outros fluxos | Eng. óDois | — |
| T11 | MCP do serviço: transporte e autenticação de hosts (OAuth como o MCP do Twenty vs API token por usuário) | seguir padrão OAuth 2.1 do Twenty (`engine/api/mcp/guards/mcp-auth.guard.ts`) | Eng. óDois | F4 |
| T12 | Detecção de edições diretas nos objetos do Twenty fora do fluxo | webhook de saída (recomendado) vs polling de reconciliação; provavelmente ambos | Eng. óDois | F1 |

## 3. Questões jurídicas/licenciamento

| # | Questão | Observações | Decisor |
|---|---|---|---|
| J1 | Qualificação AGPL do App óDois | O app é instalado via manifest e usa apenas APIs públicas do `twenty-sdk`; o serviço é obra separada comunicando por rede. Confirmar com assessoria: (a) status do app como obra derivada ou não; (b) licença efetiva dos pacotes npm `twenty-sdk`/`twenty-client-sdk` publicados; (c) obrigações caso o Twenty self-hosted seja modificado no futuro | Jurídico óDois |
| J2 | DPAs com provedores de LLM e política de não-treinamento | pré-requisito para enviar conteúdo de mensagens a LLM externa | Jurídico/DPO |
| J3 | Guarda de trilha de aprovação vs direito de apagamento LGPD | ponderação registrada em `09` §6 — validar prazo de guarda | Jurídico/DPO |
| J4 | Termos de uso do WhatsApp Business via Evolution API (não-oficial) | risco de bloqueio de número; avaliar número dedicado e plano B (WhatsApp Cloud API oficial) | Direção/Jurídico |

## 4. Conflitos com padrões existentes (registrados)

| Conflito | Tratamento nesta especificação |
|---|---|
| Enunciado sugere FastAPI/Celery/Pydantic (Python); repo é 100% TypeScript | Decidido propor NestJS/BullMQ/zod (evidência em `00` §5). Se a óDois tiver time Python forte, reabrir — os contratos (06/07/08/09) são independentes de linguagem |
| Enunciado sugere n8n | Não incluído (T10) — não existe no repo |
| Enunciado lista "Twenty Apps / Front Components / Logic Functions" — nomenclatura confere com o repo (`defineFrontComponent`, `defineLogicFunction`) | Sem conflito; termos oficiais adotados |
| `status` como campo de objeto editável no CRM vs máquina de estados no serviço | Resolvido: `fieldPermission` read-only + webhook de reconciliação (T12) |
| Workflows do Twenty poderiam parecer o lugar da máquina de estados | Rejeitado com justificativa (`02` §5) — workflows ficam para notificações/rotinas |

## 5. Riscos em aberto (acompanhamento)

- **Breaking changes na plataforma de Apps** (recente e em evolução — ver churn em `packages/twenty-sdk/`): mitigação por versão fixada + workspace de homologação; risco residual permanece.
- **Bloqueio do número WhatsApp** (J4) — pode parar o canal de entrada; o fluxo manual (`POST /proposals`) é o plano de continuidade.
- **Qualidade da extração LLM em pt-BR com jargão do negócio** — piloto com revisão humana obrigatória já mitiga (nenhuma proposta sai sem humano), mas o ganho de produtividade depende da calibração (T5).
- **Fidelidade visual do PDF** (T1×N10) — decidir template antes de fixar o renderizador.
