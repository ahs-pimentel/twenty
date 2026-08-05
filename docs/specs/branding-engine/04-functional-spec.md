# 04 — Especificação Funcional

> **Status:** proposta — nada implementado. Decisões marcadas como "proposta" exigem aprovação humana (doc 27).

## 1. Problema e objetivo

O fork óDois do Twenty precisa aplicar e gerenciar identidade visual (própria e de clientes) **sem** espalhar alterações pelo core. Hoje toda a identidade é estática (doc 01 §3): título, favicon inicial, logos default, manifest, cores, fontes e e-mails carregam a marca Twenty. O `o2d-branding-engine` centraliza isso em configuração validada, versionada e publicável, resolvida por workspace e por domínio.

## 2. Escopo funcional

Capacidades (mapeadas às fases do roadmap, doc 26):

| Capacidade | Fase |
|---|---|
| Identidade óDois global (logos, favicon, título, cores, temas claro/escuro) | 2 |
| Tela administrativa (Configurações → Identidade visual) com rascunho/validação/publicação | 3 |
| Preview (login, dashboard, tabela, kanban, formulário, modal; claro/escuro; responsivo) | 4 |
| Versionamento, changelog, rollback | 4 |
| Branding por workspace e por domínio, cache e bootstrap sem flash | 5 |
| Upstream bridge (adapters, patches, regressão visual) — processo desde a Fase 1 | 6 |
| E-mails, documentos, PWA, login avançado, presets por cliente | 7 |

Fora de escopo: editor de layout arbitrário, temas por usuário final (o Twenty já tem claro/escuro por membro — mantido), marketplace de temas, CSS custom irrestrito (ver §6).

## 3. Níveis de personalização (Etapa 4 da missão)

### Nível 1 — Branding seguro (administradores comuns do workspace)

Somente **tokens validados** e assets sanitizados; impossível quebrar acessibilidade ou funcionalidade (invariantes doc 16).

- Marca: nome do produto, nome curto, descrição; logo claro, logo escuro, logo compacto; favicon.
- Cores: `brand.primary`, `brand.onPrimary` (sugerido automaticamente), `background.*`, `surface.*`, `text.primary/secondary`; presets prontos.
- Interface: tema claro/escuro habilitados, aparência da sidebar (clara/escura), `radius.*` dentro dos limites, `shadow.*` por presets (sm/md/lg), bordas.
- Tudo passa por validação de contraste bloqueante.

### Nível 2 — Branding avançado (administradores técnicos)

Tudo do Nível 1, mais:

- Tipografia: família (de um catálogo curado — ver restrição abaixo), escala, pesos.
- Densidade (`layout.density`), espaçamentos derivados, sombras avançadas, estilos de status.
- Login: imagem, disposição (layouts pré-definidos), título/subtítulo, mensagem legal.
- Aparência de header, tabelas, kanban, formulários — **exclusivamente via tokens de componente** (doc 09 §2.2), nunca CSS.
- E-mails e documentos (Fase 7): logo, cores de destaque, footer.

Restrição: **upload de arquivos de fonte pelo usuário final não é permitido** sem análise prévia de licença e segurança pela óDois; o catálogo de fontes é mantido pela distribuição (auto-hospedadas — remove a dependência do Google Fonts CDN presente em `index.html:31-38`, também por LGPD).

### Nível 3 — Distribuição óDois (somente mantenedores do fork)

Controlado por configuração de build/deploy e código, **nunca** editável por clientes:

- Providers globais, component overrides, patches do core (doc 22).
- Feature flags do engine, rotas, navegação, metadados/manifest da distribuição.
- Fallbacks de assets da distribuição, adapters por versão, degraus manuais da escala de marca.
- Configurações de build e distribuição, versionamento `X.Y.Z-o2d.N` (doc 21).

**Regra de editabilidade**: um cliente nunca edita nada que (a) afete outro workspace, (b) altere comportamento funcional, (c) toque superfícies de segurança/legal (doc 17), ou (d) dependa da versão do Twenty (responsabilidade dos adapters).

## 4. Interface administrativa (Etapa 11 da missão)

Localização: Configurações → **Identidade visual** (instalada preferencialmente como Twenty App com `navigation-menu-items`/`page-layouts` — doc 13; fallback: rota de settings via patch fino).

```text
Configurações
└── Identidade visual
    ├── Visão geral      status, versão publicada, última alteração, responsável,
    │                    domínios, compatibilidade do adapter, alertas (contraste,
    │                    assets ausentes)
    ├── Marca            nome, nome curto, descrição, logos (claro/escuro/compacto),
    │                    favicon, título do navegador, textos de apoio
    ├── Cores            edição por tokens, presets, validação de contraste ao vivo,
    │                    visualização clara/escura lado a lado, cores derivadas
    ├── Tipografia       família (catálogo), pesos, tamanhos, escala, preview
    ├── Interface        raio, sombra, densidade, largura da sidebar, estilo de
    │                    cards/botões/inputs (tokens de componente)
    ├── Sidebar          clara/escura, cores, item ativo
    ├── Login            logo, imagem, background, título, subtítulo, disposição,
    │                    tema, mensagem legal
    ├── Assets           biblioteca com estados (válido/processando/rejeitado),
    │                    versões, fallbacks
    ├── E-mails          (Fase 7) logo, cores, footer
    ├── Documentos       (Fase 7) cabeçalho, marca d'água
    ├── Temas            gerenciamento de presets claro/escuro
    ├── Versões          histórico, diff entre versões, restauração
    └── Publicação       Salvar rascunho · Visualizar · Validar · Publicar ·
                         Restaurar versão · Descartar alterações
```

Comportamentos-chave:
- Edição sempre em **rascunho**; nada afeta o tema publicado até "Publicar" (invariante testável — cenário 8, doc 23).
- "Validar" roda o pipeline do doc 06 §validação e mostra erros por token com valores medidos.
- "Publicar" exige validação verde + permissão de publicação (RBAC doc 17) e registra versão imutável (doc 15).
- Visão geral exibe a matriz de compatibilidade do adapter instalado (doc 10).

## 5. Requisitos funcionais numerados

| ID | Requisito |
|---|---|
| RF-01 | Aplicar identidade da distribuição (óDois) na ausência de branding de workspace/domínio |
| RF-02 | Configurar branding por workspace; RF-03 por domínio (prioridade doc 12 §2) |
| RF-04 | Temas claro e escuro independentes e ambos validados |
| RF-05 | Substituir logos (claro/escuro/compacto), favicon, imagem de login |
| RF-06 | Alterar cores globais, tipografia, raios, sombras, densidade — só via tokens |
| RF-07 | Personalizar sidebar e tela de login dentro dos limites do nível do editor |
| RF-08 | Título do navegador e metadados configuráveis; manifest PWA gerado |
| RF-09 | Preview fiel antes da publicação, sem afetar usuários (cenário 9, doc 23) |
| RF-10 | Versionar configurações; restaurar versões (rollback como nova versão, doc 15) |
| RF-11 | Auditoria de toda mutação (doc 18 `BrandingAuditEvent`) |
| RF-12 | Compatibilidade com atualizações do Twenty via adapters + upstream bridge |
| RF-13 | Fallback seguro em qualquer falha (config inválida, asset ausente, adapter incompatível) — a aplicação nunca fica sem tema utilizável |
| RF-14 | E-mails e documentos com branding (Fase 7) |

## 6. Custom CSS (Etapa 16 da missão) — análise e recomendação

Riscos de permitir CSS livre: quebra global de layout, vazamento entre workspaces (se injetado sem escopo), conflito silencioso com cada atualização do Twenty (seletores internos não são API), ocultação de elementos críticos (avisos legais, modais de permissão), sobreposição de modais via z-index, exfiltração de dados por `url()` externo, XSS via `expression`/`-moz-binding` históricos, custo de suporte imprevisível.

| Opção | Avaliação |
|---|---|
| A — proibir custom CSS | Máxima segurança; pode frustrar casos extremos |
| B — apenas tokens | Segurança equivalente à A com flexibilidade real; cobre todos os requisitos listados no contexto da solução |
| C — CSS validado e escopado | Sanitização de CSS é frágil (parser próprio, lista de propriedades, bloqueio de `url()` externo, rebase constante a cada mudança de DOM do upstream); alto custo permanente |
| D — CSS somente para mantenedores óDois | Risco controlado: quem escreve é quem mantém o fork e responde pelos conflitos |

**Recomendação (proposta, não decisão): B + D.** Clientes (Níveis 1–2) operam exclusivamente por tokens; a distribuição (Nível 3) pode manter folhas de estilo próprias **como patches versionados e testados** (doc 22), nunca como campo de configuração em banco. Reavaliar C somente se um requisito concreto de cliente não for expresso em tokens — e então preferir **criar um novo token** a abrir CSS.

## 7. Regras invioláveis (aplicam-se a todos os níveis)

1. Branding nunca oculta avisos legais, telas de segurança, prompts de permissão ou ações críticas (tokens de z-index/visibilidade são somente leitura — doc 16 §3).
2. Um workspace jamais lê ou recebe branding de outro (isolamento testado — cenários 3 e 16, doc 23).
3. Publicação exige validação verde; não existe "forçar publicação".
4. Preview e rascunho nunca alteram o publicado.
5. Nenhum asset é servido sem passar pela sanitização (doc 11).
