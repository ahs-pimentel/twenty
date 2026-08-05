# 02 — Mapa de Impacto

> Classificação de cada ponto do sistema em: **reutilizar · estender · criar do zero · desacoplar · alterar · substituir**, com prioridade (Obrigatória MVP / Recomendada / Evolução futura / Dívida técnica / Não necessária).
>
> Decisão estruturante (ver `04-technical-spec.md`): **nenhum arquivo do core do Twenty é alterado**. O módulo = App óDois (extensão declarativa instalada) + Serviço de Propostas proprietário (repositório separado) + Evolution API (externa). Isso elimina a categoria "alterar/substituir" dentro deste repositório — registrado explicitamente abaixo.

## 1. Reutilizados sem alteração (core do Twenty)

| Componente | Caminho atual | Responsabilidade atual | Uso pelo módulo | Risco | Migration? |
|---|---|---|---|---|---|
| Motor de metadados | `packages/twenty-server/src/engine/metadata-modules/{object,field}-metadata/` | Objetos/campos dinâmicos | Hospeda os objetos do App óDois (proposal, proposalItem, serviceCatalogItem, proposalTemplate) | Baixo — API pública estável | Migrations de workspace são geradas automaticamente pela instalação do app (mecanismo nativo) |
| Plataforma de Apps | `packages/twenty-sdk/`, `engine/core-modules/application/`, `packages/twenty-apps/` (exemplos) | Definir/instalar apps como código | Base do App óDois (`twenty app:publish --private`) | Médio — plataforma recente; acompanhar breaking changes do SDK | Não |
| REST/GraphQL + client SDK | `engine/api/`, `packages/twenty-client-sdk/` | CRUD de registros | Serviço de Propostas lê/escreve objetos via API key | Baixo | Não |
| RBAC | `engine/metadata-modules/{role,object-permission,permission-flag}/` | Papéis e permissões | Roles do app (`proposal-*`); fieldPermission para `status`/hashes somente-leitura | Baixo | Não |
| API keys | `engine/core-modules/api-key/` | Credenciais de integração | Credencial do Serviço de Propostas com role restrita | Baixo | Não |
| Webhooks de saída | `engine/metadata-modules/webhook/` | Notificar sistemas externos com HMAC | Twenty → Serviço (ex.: edição manual de proposal no CRM dispara sync/invalidations) | Baixo | Não |
| Logic functions (httpRoute/tool) | `engine/{metadata-modules,core-modules}/logic-function/` | Código do app no servidor | Proxies autenticados UI → Serviço; tools de agente (fase 4) | Médio — driver LOCAL vs LAMBDA conforme hospedagem | Não |
| Front components + sandbox | `packages/twenty-front-component-renderer/`, SDK `front-component/` | UI custom de apps | Painel de revisão, diff de versões, modal de confirmação de envio | Médio — capacidades do sandbox (ex.: viewer de PDF) a validar | Não |
| Command menu items | `packages/twenty-sdk/src/sdk/define/command-menu-items/`, front `command-menu-item/` | Ações rápidas | "Solicitar aprovação", "Aprovar", "Enviar…" (com confirmação) | Baixo | Não |
| Timeline/auditoria visível | `modules/timeline/`, `engine/core-modules/event-logs/` | Trilha de atividades | Espelho comercial dos eventos da proposta no CRM | Baixo | Não |
| Storage + URLs assinadas | `engine/core-modules/file-storage/`, `file/file-url/` | Arquivos com entrega segura | Padrão replicado no serviço (S3/MinIO próprio); anexos de proposta no Twenty referenciam URLs do serviço | Baixo | Não |
| Stack LLM | `engine/metadata-modules/ai/ai-models/`, deps `ai@6`/`@ai-sdk/*` | Providers/modelos | Mesmo stack no worker do serviço (dependências próprias, mesmos providers) | Baixo | Não |
| E-mail | `packages/twenty-emails/`, `engine/core-modules/email/` | Notificações por e-mail | Notificação de revisão/aprovação pendente (MVP) | Baixo | Não |
| MCP nativo do Twenty | `engine/api/mcp/` | Tools genéricas de CRM | Consulta de registros por agentes; **não** usado para ações de proposta (gates ficam no serviço) | Baixo | Não |

## 2. Estendidos (via mecanismos oficiais, sem tocar código do core)

| Extensão | Mecanismo | Problema/limitação atual | Mudança recomendada | Prioridade | Risco/Impacto |
|---|---|---|---|---|---|
| Objetos padrão `company`/`person`/`opportunity` | Relações definidas nos objetos do app (`fields/*.field.ts` no App óDois) | Não conhecem propostas | Relações `proposals` (1:N) a partir do objeto `proposal` | **Obrigatória MVP** | Baixo; sem migration manual (instalação do app) |
| Person | Campo de app | Telefone WhatsApp não é validado como identidade | Usar `phones` existente como chave de matching; campo adicional `waPhoneVerifiedAt` no app se necessário | Recomendada | Baixo |
| Views/Layouts | `views/*.view.ts`, `page-layouts/*.page-layout.ts` do app | — | Kanban por status, página da proposta com abas (itens, versões, eventos, prévia) | **Obrigatória MVP** | Baixo |
| Notificação de revisão | E-mail (existente) + timeline + snackbar | Não há notificação in-app persistente (`00-project-analysis.md` §3.6) | MVP: e-mail + registro na timeline; Evolução: workflow do Twenty (trigger DATABASE_EVENT em proposal.status) para tarefas/menções | Obrigatória MVP (e-mail) / Evolução (mais canais) | Baixo |
| Agente Twenty do módulo | `agents/*.agent.ts` do app (opcional) | — | Agente somente-leitura para perguntas sobre propostas no chat do CRM | Evolução futura | Médio (escopo de role do agente) |

## 3. Criados do zero (proprietários óDois — fora deste repositório)

| Componente | Onde vive | Responsabilidade | Prioridade | Dependências | Risco |
|---|---|---|---|---|---|
| App óDois (`odois-proposals`) | Repo próprio `odois-proposal-app/` (scaffold `create-twenty-app`) | Objetos, campos, roles, views, front components, command menu, logic functions proxy | **Obrigatória MVP** | twenty-sdk; workspace Twenty | Breaking changes do SDK |
| Serviço de Propostas | Repo próprio `odois-proposal-service/` (NestJS) | Webhooks Evolution, máquina de estados, snapshots/hashes, aprovação, envio, APIs (`06-api-contracts.md`) | **Obrigatória MVP** | Postgres, Redis, storage, Twenty API, Evolution API | Núcleo do valor; exige testes da regra central |
| Worker de Propostas | Mesmo repo do serviço (processo separado, padrão `queue-worker` do Twenty) | LLM, transcrição, geração de documentos, envios, retries | **Obrigatória MVP** (LLM/PDF); transcrição F3 | BullMQ/Redis | Custos/latência LLM |
| Serviço de Documentos | Módulo interno do worker | HTML→PDF prévia (marca d'água) e final; hashes; DOCX (F3) | **Obrigatória MVP** | Template engine + renderizador (decisão em `15-open-questions.md`) | Fidelidade visual |
| Integração Evolution API | Módulo do serviço | Instâncias, webhooks, envio, mídia | **Obrigatória MVP** | Instância Evolution provisionada | Contrato varia por versão da Evolution |
| Banco interno do serviço | Postgres próprio | proposal_version, proposal_approval, proposal_source_message, proposal_event, evolution_instance, wa_session, document_artifact, idempotency_key | **Obrigatória MVP** | — | — |
| MCP do serviço | Módulo do serviço (`/mcp`) | Tools `proposal.*` com classificação de risco e confirmação humana | Evolução futura (F4) | serviço estável | Governança de agentes |
| Transcrição de áudio | Worker (provider externo, ex.: Whisper API — decisão F3) | Áudio → texto | Evolução futura (F3) | provider | Custo/qualidade pt-BR |

## 4. Desacoplamentos deliberados

| Desacoplamento | Justificativa | Prioridade |
|---|---|---|
| Serviço de Propostas fora do processo do Twenty | (a) AGPL: código proprietário óDois não deriva do core; (b) ciclo de release independente dos upgrades do Twenty; (c) blast radius: falha do módulo não derruba o CRM | **Obrigatória MVP** |
| Fonte de verdade dividida: comercial no Twenty, técnica/imutável no serviço | Versões, hashes, aprovações e eventos são append-only e não devem ser editáveis pela UI genérica do CRM; o Twenty guarda referências (IDs/URLs), evitando duplicação | **Obrigatória MVP** |
| Envio ao solicitante isolado num único job com gate | Um único caminho de código pode enviar; tudo mais é fisicamente incapaz | **Obrigatória MVP** |
| LLM confinada ao worker, saída só-dados | Nenhuma ferramenta de escrita/envio exposta ao modelo | **Obrigatória MVP** |

## 5. Alterações/substituições no core do Twenty

**Nenhuma.** Avaliadas e rejeitadas:

| Hipótese avaliada | Por que rejeitada |
|---|---|
| Adicionar módulo `proposals` em `packages/twenty-server/src/modules/` (como company/opportunity) | Vira fork: cada upgrade do Twenty exigiria rebase; AGPL obrigaria disponibilizar o fonte a usuários de rede do serviço modificado; a plataforma de Apps cobre o mesmo resultado sem custo de manutenção |
| Implementar canal WhatsApp dentro de `modules/messaging/` (driver novo tipo `sms`) | `MessageChannelType.SMS` existe declarado sem implementação (`packages/twenty-shared/src/types/MessageChannelType.ts`); implementar seria mudança profunda no core de sync de mensagens, acoplada a upgrades — a Evolution API já resolve o transporte externamente |
| Usar Workflows do Twenty como máquina de estados da proposta | Workflows modelam *execuções* (runs), não ciclo de vida com gates de aprovação, hashes e invalidação; regras críticas ficariam editáveis pela UI de workflow (risco de burla) — workflows ficam como *complemento* para notificações/rotinas |
| Guardar versões/aprovações como objetos Twenty editáveis | Objetos do CRM são mutáveis por design (edição inline, merge, delete); trilha de aprovação exige append-only com hash — fica no Postgres do serviço |

Caso alguma limitação futura exija mudança no core (ex.: novo ponto de extensão), o caminho é **contribuição upstream** ao projeto Twenty, nunca fork privado — implicação AGPL e de manutenção registrada em `15-open-questions.md`.

## 6. Riscos de acoplamento ao núcleo — e como o desenho os evita

| Risco | Mitigação no desenho |
|---|---|
| Breaking changes do SDK de apps / manifest | App usa apenas APIs públicas de `twenty-sdk/src/sdk/define/`; CI do app roda contra versão fixada; upgrade de Twenty testado em workspace de homologação antes de produção |
| Mudanças na REST/GraphQL dinâmica | Acesso somente via `twenty-client-sdk` (tipado, versionado com o server) |
| Campo `status` editado por dentro do CRM burlando a máquina de estados | `fieldPermission` somente-leitura + webhook de saída Twenty→Serviço para detectar/reverter escrita fora do fluxo + validação de status no serviço como autoridade final |
| Dependência do formato de webhook do Twenty | Payload documentado (`engine/metadata-modules/webhook/utils/transform-event-batch-to-webhook-events.ts`); testes de contrato com fixtures |
| Sandbox de front components sem viewer de PDF adequado | Fallback: abrir prévia via URL assinada em nova aba; validar spike na F1 (`15-open-questions.md`) |

## 7. Dívidas técnicas identificadas no contexto do módulo

| Item | Natureza | Ação |
|---|---|---|
| `twenty-cli` depreciado | Repo Twenty | Não usar; usar `twenty-sdk` (CLI `twenty`) |
| `MessageChannelType.SMS` sem driver | Repo Twenty | Não construir sobre isso; registrar que um eventual canal WhatsApp nativo do Twenty seria upstream |
| `twenty-companion` (transcrição) é POC | Repo Twenty | Não reutilizar código; apenas referência de UX |
| Ausência de notificações in-app persistentes | Repo Twenty | Conviver (e-mail + timeline); avaliar contribuição upstream — Evolução futura |

## 8. Resumo por prioridade

- **Obrigatórias para o MVP**: App óDois (objetos, roles, views, painel de revisão, ações), Serviço de Propostas + Worker + Documentos (PDF prévia/final + hashes + gate), integração Evolution (texto), banco interno, notificação por e-mail, relações com company/person/opportunity.
- **Recomendadas**: webhook Twenty→Serviço para detecção de edições fora do fluxo; workspace de homologação para upgrades; testes de contrato com fixtures.
- **Evolução futura**: MCP do serviço, agente Twenty do módulo, transcrição, DOCX, assinatura eletrônica, notificações in-app (upstream).
- **Não necessárias**: qualquer alteração no core do Twenty; FastAPI/Celery/n8n (não existem no repo e o stack TypeScript cobre — n8n só se a óDois já o operar, ver `15-open-questions.md`).
