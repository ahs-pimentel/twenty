# 14 — Roadmap de Implementação

> Módulo proprietário óDois — arquitetura **proposta** (não implementada).
> Nada aqui altera o core do Twenty: em **todas as fases**, NENHUM arquivo de `packages/twenty-*` é modificado. Todo o código vive em repositórios próprios da óDois (§2). Caminhos do repo Twenty aparecem apenas como referência de padrão existente.

## 1. Visão geral das fases

| Fase | Tema | Resumo (canon) |
|---|---|---|
| F1 | MVP | Texto, webhook Evolution, extração LLM, rascunho, cadastro no Twenty, prévia, revisão, aprovação, envio autorizado manualmente |
| F2 | Qualidade comercial | Perguntas complementares, catálogo, precificação, margem, templates, versionamento, comparação |
| F3 | Mídia e pós-envio | Áudio, anexos, transcrição, DOCX, tracking de visualização, aceite |
| F4 | Governança e expansão | Regras avançadas de aprovação, múltiplos aprovadores, assinatura eletrônica, contratos/projetos, MCP |

A regra central («nenhuma proposta enviada sem aprovação humana explícita da versão exata») e o gate `canSendProposal` (doc 09 §1.2) valem **desde a F1** — não são incrementais.

## 2. Estrutura de repositórios (proposta)

```
odois-proposal-app/            # Twenty App proprietário (manifest por convenção, padrão do SDK)
├── application.config.ts
├── objects/                   # proposal, proposalItem, serviceCatalogItem, proposalTemplate
├── fields/
├── roles/                     # proposal-attendant/-owner/-reviewer/-approver/-admin
├── views/
├── components/                # *.front-component.tsx (revisão, aprovação, envio)
├── logic-functions/           # proxies UI → Serviço de Propostas (httpRoute/tool)
├── navigation-menu-items/
└── page-layouts/

odois-proposal-service/        # Serviço de Propostas (NestJS, Postgres+Redis próprios)
├── src/
│   ├── proposal/              # máquina de estados, gate, versões, aprovação
│   ├── evolution/             # webhooks entrada + cliente de envio
│   ├── interpretation/        # pipeline LLM (worker)
│   ├── documents/             # Serviço de Documentos (HTML→PDF, hashes)
│   ├── twenty-sync/           # twenty-client-sdk + API key
│   └── queue-worker/          # Worker de Propostas (BullMQ, padrão src/queue-worker/ do Twenty)
├── test/integration/
└── e2e/                       # Playwright + mock Evolution
```

Padrões de origem no repo Twenty (somente referência): manifest de app por convenção (`packages/twenty-apps/examples/postcard/`, `packages/twenty-sdk/src/sdk/define/index.ts`), worker (`packages/twenty-server/src/queue-worker/queue-worker.ts`), client SDK (`packages/twenty-client-sdk`).

---

## 3. Fase 1 — MVP

### 3.1 Objetivos

Fluxo completo texto→proposta→aprovação→envio com a regra central integralmente aplicada; operação em 1 workspace piloto com 1 instância Evolution.

### 3.2 Entregáveis por componente

| Componente | Entregáveis |
|---|---|
| App óDois | Objetos `proposal`/`proposalItem` (campos-chave do canon, `status` SELECT read-only para usuários); roles dos 5 papéis internos; views básicas; front components de revisão/aprovação/envio (side panel); logic functions proxy para os endpoints do serviço; item de navegação |
| Serviço de Propostas | Máquina de estados declarativa (doc 07 §6); endpoints `POST /webhooks/evolution/messages`, `POST/GET/PATCH /proposals`, `/interpret`, `/generate-preview`, `/request-changes`, `/request-approval`, `/approve`, `/reject`, `/generate-final`, `/send`, `/retry-send`, `/versions`, `/events`; tabelas internas (`proposal_version`, `proposal_approval`, `proposal_source_message`, `proposal_event`, `evolution_instance`, `wa_session`, `document_artifact`, `idempotency_key`); gate `canSendProposal` + lock; auth JWT de serviço/API key interna/token+HMAC webhook |
| Worker | Jobs: agrupamento de mensagens, interpretação (LLM texto), geração de prévia (marca d'água) e final, envio; retries + DLQ; jobId determinístico |
| Integração Evolution | Recepção de mensagens de **texto** (webhook validado, dedupe), envio do PDF final, tratamento básico de status de entrega |
| Documentos | Prévia PDF com marca d'água "PRÉVIA — NÃO ENVIAR", final sem; hashes SHA-256 de snapshot e PDF; storage S3/MinIO com URLs assinadas |

### 3.3 Dependências

- **Técnicas**: instância Evolution API provisionada e conectada; API key Twenty com role restrita aos objetos do módulo; chaves de provider LLM; Postgres/Redis/S3(MinIO) do serviço; workspace Twenty com suporte a instalação de apps.
- **De decisão**: provider/modelo LLM default; política `selfApprovalAllowed` do MVP (canon: permitido com registro); template único de proposta (layout aprovado pela óDois); revisão jurídica AGPL registrada como questão aberta (doc 02/04).

### 3.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Extração LLM de baixa qualidade em pedidos reais | `confidenceScore` + `NEEDS_INFORMATION`; revisão humana obrigatória já cobre erro residual; fixtures reais alimentam ajuste de prompt |
| Instabilidade da Evolution API (não oficial) | Retries limitados + `SEND_ERROR` + reenvio humano; monitoração da instância; mock nos testes |
| Bypass do fluxo por chamada direta à API | Gate único no backend + matriz de autorização + suíte RC-01…RC-10 do doc 13 §4 como gate de CI desde o 1º release |
| Escopo do app crescer para dentro do core Twenty | Regra de arquitetura (canon): qualquer necessidade não atendível por app/serviço externo vira questão de decisão, nunca patch no core |

### 3.5 Critérios de aceite (checklist)

- [ ] Mensagem de texto no WhatsApp piloto gera proposta em `AWAITING_INTERNAL_REVIEW` com prévia visível no Twenty
- [ ] Envio é impossível sem `APPROVED` + documento final + gate satisfeito (RC-01, RC-02)
- [ ] Alteração pós-aprovação invalida aprovação (RC-03)
- [ ] Webhook duplicado não duplica proposta (RC-04)
- [ ] Prévia com marca d'água, final sem (RC-09, RC-10)
- [ ] Todos os eventos do ciclo em `proposal_event` com actor/correlationId
- [ ] Zero arquivos alterados no repo Twenty (verificável por diff)

### 3.6 Testes (ref. doc 13)

Obrigatórios na F1: §2.1 (máquina de estados, gate, hash, parsers), §2.2, §2.4, §2.5, §2.6 (property-based 441 pares), §2.7, §2.8, §2.9, §2.10, §2.11, §2.12, §2.13, §2.14 (cenário feliz), §2.15 (authz, replay) e a suíte completa RC-01…RC-10 (§4) como gate de release.

### 3.7 Fora da F1 (marcos de corte)

Áudio/anexos/transcrição; perguntas complementares automáticas ao solicitante (na F1, dados faltantes são completados manualmente pelo atendente); catálogo/precificação automática (preços digitados pelo responsável); templates múltiplos; comparação de versões (versões existem e são imutáveis desde a F1 — apenas a UI de comparação fica para a F2); tracking de visualização; aceite automatizado; MCP; múltiplos aprovadores.

### 3.8 Esforço relativo

| Componente | Esforço |
|---|---|
| App óDois | M |
| Serviço de Propostas | G |
| Worker | M |
| Integração Evolution | M |
| Documentos | M |

---

## 4. Fase 2 — Qualidade comercial

### 4.1 Objetivos

Reduzir intervenção manual: o sistema pergunta o que falta, precifica pelo catálogo com regras determinísticas e dá ao revisor ferramentas de versão/template.

### 4.2 Entregáveis por componente

| Componente | Entregáveis |
|---|---|
| App óDois | Objetos `serviceCatalogItem` e `proposalTemplate`; views/permissões de catálogo (só `proposal-admin` altera preços/margens — doc 09 §2.2); UI de comparação de versões (diff campo a campo); seleção de template na revisão |
| Serviço de Propostas | Motor de perguntas complementares (`NEEDS_INFORMATION` → mensagens operacionais via Evolution, templates pré-aprovados sem valores comerciais — doc 07 §3.4); matching item↔catálogo; precificação determinística (subtotal/desconto/total, `minPrice`/`minMarginPercent`, flag `requiresApproval`); endpoints de versões/diff |
| Worker | Job de timeout de `NEEDS_INFORMATION` (ex.: 72h → `CANCELED`); reinterpretação incremental com contexto da conversa |
| Integração Evolution | Envio de perguntas complementares; retorno de respostas ao ciclo (`NEEDS_INFORMATION → COLLECTING_MESSAGES`) |
| Documentos | Renderização multi-template (template + versão do template entram no snapshot/hash) |

### 4.3 Dependências

- Técnicas: F1 em produção no piloto; base de catálogo da óDois higienizada para carga.
- De decisão: política de margem mínima e alçadas de desconto; redação dos templates de pergunta; regra de matching (exato vs. fuzzy com confirmação humana).

### 4.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Loop de perguntas irritar o solicitante | Limite de rodadas de pergunta por proposta + fallback para atendente humano |
| Matching de catálogo errado precificar errado | Matching sugere, humano confirma na revisão; item sem match fica sem preço e bloqueia prévia até edição |
| Mudança de template quebrar hash de versões antigas | Versão do template no snapshot; artefatos antigos imutáveis (doc 09 §1.3) |

### 4.5 Critérios de aceite (checklist)

- [ ] Pedido incompleto gera pergunta via WhatsApp e a resposta reabre o ciclo automaticamente
- [ ] Preço nunca vem da LLM: todo item precificado tem origem `catalogItemId` ou edição humana auditada (RC-07)
- [ ] Desconto acima do limite marca `requiresApproval` e aparece na revisão
- [ ] Comparação lado a lado de duas versões quaisquer
- [ ] Troca de template gera nova versão + novo hash e, se aprovada, exige nova aprovação

### 4.6 Testes (ref. doc 13)

Novos: unit de precificação/margem (§2.1); contrato dos templates de pergunta; integração do ciclo `NEEDS_INFORMATION` completo; idempotência de respostas do solicitante (§2.4/§2.5); regressão completa RC-01…RC-10.

### 4.7 Fora da F2

Áudio/anexos; DOCX; tracking de visualização; aceite; assinatura; MCP; regras de aprovação por alçada (a flag `requiresApproval` apenas sinaliza — política avançada é F4).

### 4.8 Esforço relativo

| Componente | Esforço |
|---|---|
| App óDois | M |
| Serviço de Propostas | G |
| Worker | M |
| Integração Evolution | P |
| Documentos | M |

---

## 5. Fase 3 — Mídia e pós-envio

### 5.1 Objetivos

Aceitar pedidos por áudio/anexo e fechar o ciclo pós-envio: saber quando o cliente viu e registrar o aceite.

### 5.2 Entregáveis por componente

| Componente | Entregáveis |
|---|---|
| App óDois | Exibição de transcrições e anexos na revisão; timeline pós-envio (`sentAt`/`viewedAt`/`acceptedAt`); ação "registrar aceite/recusa" |
| Serviço de Propostas | Ingestão de mídia (download seguro — padrão SSRF-guard análogo ao `secure-http-client` do Twenty); endpoint de status `POST /webhooks/evolution/status` ampliado para leitura/visualização; fluxo `SENT → VIEWED → ACCEPTED/REJECTED/EXPIRED` (aceite interpretado pela LLM **sempre** confirmado por humano — doc 07 §3.16); exportação **DOCX** do documento aprovado |
| Worker | Transcrição de áudio (provider a definir na fase); processamento de anexos; job de expiração (`validUntil` → `EXPIRED`) |
| Integração Evolution | Recepção de áudio/documento/imagem; callbacks de entrega/leitura mapeados para `VIEWED` |
| Documentos | Geração DOCX além do PDF (ver nota abaixo); hash também para o artefato DOCX |

> **Nota DOCX (decisão de fase, não decidida)**: o repo Twenty **não possui** geração DOCX (canon — PDF via `@react-pdf/renderer`, ex. real em `packages/twenty-server/src/engine/core-modules/dpa/`). A biblioteca é decisão da F3 — candidata: pacote `docx` (npm) — avaliando fidelidade ao template, determinismo para hash e licença. Até a decisão, o PDF permanece o único formato canônico de envio.

### 5.3 Dependências

- Técnicas: F2 em produção; provider de transcrição (chave/contrato); suporte da versão da Evolution API a callbacks de leitura e download de mídia.
- De decisão: biblioteca DOCX; política de retenção de mídia original (default canon: 12 meses); se DOCX é enviável ao cliente ou apenas exportável internamente.

### 5.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Transcrição imprecisa gerar dados errados | Transcrição é insumo da interpretação, exibida na revisão; confiança baixa ⇒ `NEEDS_INFORMATION` |
| Mídia maliciosa (arquivo forjado) | Validação de MIME/tamanho, antivírus opcional, download via cliente HTTP com guard SSRF, storage isolado |
| Callbacks de leitura inconsistentes entre versões da Evolution | `VIEWED` é melhor-esforço; nunca condição de negócio; fixtures de contrato por versão (doc 13 §2.3) |
| DOCX não determinístico quebrar estratégia de hash | Hash do DOCX gerado uma única vez no momento da geração (artefato imutável), sem re-render comparativo |

### 5.5 Critérios de aceite (checklist)

- [ ] Áudio de pedido vira proposta com transcrição visível na revisão
- [ ] Anexos do solicitante ficam vinculados à proposta e auditados
- [ ] Callback de leitura move `SENT → VIEWED` com `viewedAt`
- [ ] Aceite sugerido pela LLM só efetiva com confirmação humana
- [ ] `validUntil` vencida move para `EXPIRED` automaticamente
- [ ] Exportação DOCX disponível para versão aprovada, com hash registrado

### 5.6 Testes (ref. doc 13)

Novos: parsers de mídia e fixtures de áudio/status (§2.1, §2.3); SSRF em URLs de mídia (§2.15); integração de transcrição com stub; fluxo pós-envio completo em E2E (§2.14); determinismo/registro de hash DOCX (§2.9 adaptado); regressão RC-01…RC-10.

### 5.7 Fora da F3

Assinatura eletrônica; múltiplos aprovadores; contratos/projetos; MCP; edição colaborativa do documento.

### 5.8 Esforço relativo

| Componente | Esforço |
|---|---|
| App óDois | P |
| Serviço de Propostas | M |
| Worker | G |
| Integração Evolution | M |
| Documentos | M |

---

## 6. Fase 4 — Governança e expansão

### 6.1 Objetivos

Aprovação com alçadas e múltiplos aprovadores, aceite juridicamente mais forte (assinatura eletrônica), continuidade pós-aceite (contrato/projeto) e acesso programático via MCP com salvaguardas.

### 6.2 Entregáveis por componente

| Componente | Entregáveis |
|---|---|
| App óDois | UI de políticas de aprovação (alçadas por valor/desconto/margem); painel de aprovações pendentes por aprovador; objetos/relações de contrato/projeto derivados do aceite (ação derivada, não transição — doc 07 §3.16); desativação de `selfApprovalAllowed` como recomendação padrão (doc 09 §2.2 nota) |
| Serviço de Propostas | Motor de regras de aprovação (N aprovadores, quórum/sequência, alçada por faixa); `proposal_approval` multi-registro por versão; integração com provedor de assinatura eletrônica (webhook de status de assinatura); **servidor MCP** com as ferramentas canônicas do doc 12 — `proposal.approve`/`generate_final_document`/`send` exigindo confirmação humana explícita (elicitation), jamais executáveis por agente autônomo; `proposal.delete_permanently` não existe |
| Worker | Jobs de orquestração de assinatura (envio ao provedor, polling/webhook, expiração de envelope); escalonamento de aprovações paradas (lembrete/realocação) |
| Integração Evolution | Envio do link/documento de assinatura conforme fluxo do provedor |
| Documentos | Carimbo/registro do artefato assinado (hash do documento assinado vinculado ao `finalDocumentHash` de origem) |

### 6.3 Dependências

- Técnicas: F3 em produção; contrato com provedor de assinatura (a selecionar); host MCP autenticado (o Twenty já expõe MCP nativo — `packages/twenty-server/src/engine/api/mcp/` — como padrão de referência, mas o servidor MCP do módulo é do Serviço de Propostas).
- De decisão: provedor de assinatura; política formal de alçadas da óDois; segregação de funções obrigatória (autor ≠ aprovador); escopo jurídico do aceite via WhatsApp vs. assinado.

### 6.4 Riscos e mitigação

| Risco | Mitigação |
|---|---|
| MCP ampliar superfície de ataque para ações sensíveis | Ferramentas sensíveis com confirmação humana obrigatória; credencial de agente estruturalmente sem `approve`/`send` (matriz doc 09 §2.2); testes de escalação (doc 13 §2.15) |
| Regras de aprovação complexas travarem o funil | Fallback configurável (alçada única) + escalonamento automático; métricas de tempo em `PENDING_APPROVAL` |
| Divergência entre documento assinado e aprovado | Cadeia de hashes: snapshot → PDF final → artefato assinado, verificada ponta a ponta |

### 6.5 Critérios de aceite (checklist)

- [ ] Proposta acima da alçada exige o conjunto correto de aprovadores; qualquer reprovação interrompe
- [ ] Nenhuma combinação de chamadas MCP aprova ou envia sem confirmação humana registrada (extensão de RC-01/RC-08)
- [ ] Documento assinado arquivado com hash vinculado à versão aprovada
- [ ] Aceite gera contrato/projeto vinculado no Twenty sem alterar o estado terminal `ACCEPTED`
- [ ] Auditoria reconstrói a cadeia completa: pedido → versões → aprovações (N) → envio → assinatura

### 6.6 Testes (ref. doc 13)

Novos: property-based do motor de regras (nenhuma combinação de aprovações parciais libera o gate); contrato MCP (ferramentas, exclusões, elicitation); contrato do provedor de assinatura com fixtures; segurança MCP (§2.15); regressão RC-01…RC-10.

### 6.7 Fora da F4 (backlog não planejado)

Portal web do cliente; multilíngue; outros canais (e-mail/Telegram); analytics de conversão; billing por proposta.

### 6.8 Esforço relativo

| Componente | Esforço |
|---|---|
| App óDois | M |
| Serviço de Propostas | G |
| Worker | M |
| Integração Evolution | P |
| Documentos | P |

---

## 7. Estratégia de rollout

| Mecanismo | Descrição |
|---|---|
| Workspace piloto | Cada fase entra primeiro em 1 workspace piloto da óDois com usuários reais dos 5 papéis; expansão só após período de observação com métricas (propostas/dia, taxa de `PROCESSING_ERROR`, tempo em revisão) |
| Feature flags no serviço | Capacidades por fase atrás de flags de configuração do Serviço de Propostas (por workspace/instância Evolution): ex. `FEATURE_FOLLOWUP_QUESTIONS`, `FEATURE_AUDIO`, `FEATURE_MCP`. O App óDois esconde UI de recurso desligado; o serviço rejeita chamadas de recurso desligado (flag no backend é a barreira, UI é UX) |
| Plano de rollback | (1) Desligar a flag do recurso — dados novos param de ser produzidos, dados existentes permanecem legíveis; (2) rollback do deploy do serviço (imagem anterior) — migrações de banco do serviço são forward-compatible (expand/contract), nunca destrutivas dentro de uma fase; (3) desinstalação do App óDois é o último recurso e não apaga o histórico técnico, que vive no Postgres do serviço; (4) tabelas append-only (`proposal_version`, `proposal_approval`, `proposal_event`) nunca sofrem rollback de dados |
| Gate de release | A suíte RC-01…RC-10 (doc 13 §4) é obrigatória em toda promoção de fase e todo deploy do serviço |
