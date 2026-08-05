# 17 — Segurança

> **Status:** proposta — nada implementado.

## 1. RBAC

Reutiliza o modelo de permissões do Twenty (padrão observado: `SettingsPermissionGuard(PermissionFlagType.WORKSPACE)` no upload de logo — `file-core-picture.resolver.ts:36-56`; Apps contribuem `roles` e `permission-flags` — doc 00 §2).

| Permissão | Capacidade | MVP | Evolução |
|---|---|---|---|
| `BRANDING_VIEW` | ler configurações/versões do próprio workspace | `WORKSPACE` flag | flag própria |
| `BRANDING_EDIT` | editar rascunho Nível 1 | `WORKSPACE` | flag própria |
| `BRANDING_EDIT_ADVANCED` | seções Nível 2 (tipografia, densidade, login avançado) | — | flag própria |
| `BRANDING_PUBLISH` | publicar e rollback | `WORKSPACE` | flag separada de edição (segregação de funções) |
| `BRANDING_ASSETS` | upload/exclusão de assets | acompanha EDIT | flag própria |
| Nível 3 (distribuição) | adapters, patches, presets globais, fallbacks | **fora de RBAC de workspace** — só via repositório/deploy do fork | idem |

Regras: publicar exige permissão distinta de editar (dois pares de olhos possível); rollback = mesma permissão de publicar + motivo obrigatório; nenhum papel de workspace acessa configuração de outro workspace (escopo do guard + testes 3/16 do doc 23).

## 2. Superfícies de ataque e mitigações

| Vetor | Mitigação |
|---|---|
| **SVG malicioso** (script, event handlers, foreignObject, entidades, referências externas) | sanitização por allowlist no pipeline de ingestão (doc 11 §3); SVG nunca servido sem sanitização; testes com corpus de SVGs maliciosos (cenários 5–6, doc 23) |
| **CSS injection via valores de token** (`;}`, `url()`, `@import`, `expression`) | tokens são tipados e validados por formato (cor/di­mensão/número — doc 06 §4); o CSS final é **gerado** pelo core a partir de literais, nunca concatenado de strings livres; teste de fuzz sobre o gerador |
| **XSS via textos configuráveis** (nome do produto, títulos de login) | texto puro, escapado na renderização; sem HTML em nenhum campo; título via Helmet (já escapa) |
| **Exfiltração por URLs externas** | nenhum campo aceita URL; assets só por `assetId` interno; fontes auto-hospedadas (catálogo da distribuição) |
| **Ocultação de elementos críticos** (avisos legais, prompts de permissão, modais de segurança) | tokens de z-index/visibilidade/posicionamento são somente leitura (doc 09 §2.3, doc 16 §3); sem custom CSS de cliente (doc 04 §6); cenário de teste 19 |
| **Path traversal em upload/leitura** | chave de storage gerada pelo servidor (nunca do filename do usuário); leitura só por ID+hash registrados (padrão dos guards de arquivo existentes: `file-by-id.guard.ts`, `file-path-guard.ts`) |
| **Upload malicioso** (polyglot, MIME spoofing, bombas de descompressão) | magic bytes + decodificação real da imagem + limites de dimensão/tamanho antes de qualquer processamento (doc 11 §3) |
| **Vazamento entre workspaces** | chaves de cache incluem workspace/host; artefatos endereçados por hash + workspace; endpoint público só serve estado `PUBLISHED` |
| **Escalada via preview** | `previewToken` de curta duração, escopado a workspace+versão, auditado (doc 14 §3) |
| **Abuso da API** | rate limiting em upload e mutações (limites por workspace); validação assíncrona em fila (não bloqueia nem amplifica) |

## 3. Integridade e assinatura

- Artefatos e assets endereçados por SHA-256; o cliente valida o hash do artefato recebido contra o `ETag`/manifest (descarte + fallback em divergência — doc 06 §4).
- URLs temporárias assinadas (JWT, padrão `signFileByIdUrl` existente) para assets de rascunho; assets publicados são imutáveis e públicos por hash (doc 11 §4).
- Auditoria imutável: `BrandingAuditEvent` append-only na transação da mutação (outbox — docs 18/20), com ator, payload mínimo e `correlationId`.

## 4. LGPD e retenção

- Dados pessoais no módulo: apenas autoria (usuário que editou/publicou) e trilha de auditoria — minimização por design; nenhum dado de cliente final transita pelo branding.
- Retenção de versões e expurgo: doc 15 §5; auditoria segue política de retenção da distribuição com anonimização do ator no expurgo.
- Fontes auto-hospedadas eliminam o vazamento de IP de usuários ao Google Fonts presente hoje (`index.html:31-38`) — ganho direto de conformidade.
- Assets de marca de clientes são dados do cliente: exportáveis e removíveis a pedido (obligação contratual a refletir nos termos — revisão jurídica, doc 24 §7).

## 5. Segredos

Nenhum segredo em configuração de branding; specs e relatórios nunca copiam valores de `.env` (somente nomes de variáveis, como `STORAGE_S3_*`); tokens de preview e URLs assinadas nunca aparecem em logs (hash apenas — doc 20 §catálogo, `branding.preview.generated`).
