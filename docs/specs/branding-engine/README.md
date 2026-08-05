# o2d-branding-engine — Especificação Funcional, Técnica e Arquitetural

> **Pacote de especificação proprietário da óDois.** Somente documentação: nenhum código funcional, dependência, migration ou arquivo do core foi alterado. Sugestões aqui contidas **não são decisões aprovadas** (pendências no doc 27).

## Visão geral

Camada central de identidade visual e white-label para a distribuição óDois baseada no Twenty CRM. Permite configurar a identidade da plataforma por interface administrativa — cores, logos, tipografia, temas claro/escuro, favicon, título, login, sidebar, e-mails e documentos — por workspace e por domínio, com versionamento, preview, publicação e rollback, mantendo compatibilidade com atualizações do Twenty.

## Problema

Toda a identidade do Twenty instalado é estática e hardcoded (título, favicon inicial, logos default, manifest PWA, cores, fontes CDN, e-mails — doc 01 §3). Personalizar exigiria alterações espalhadas pelo core, criando um fork profundamente divergente e caro de atualizar.

## Objetivo

Transformar o fork em **distribuição controlada**: fork fino + motor central de tokens + providers globais + assets dinâmicos + adapters por versão + patches isolados + testes de regressão visual.

## Escopo / fora do escopo

**Escopo:** identidade óDois global; branding por workspace e domínio; temas claro/escuro; tokens (cores, tipografia, raios, sombras, densidade, layout); assets (logos, favicon, login, e-mail, documentos); admin UI com rascunho/validação/publicação; preview; versionamento/rollback; auditoria; upstream bridge.
**Fora:** editor de layout arbitrário; custom CSS de clientes (doc 04 §6); tema por usuário final além do claro/escuro existente; marketplace de temas.

## Princípios arquiteturais

1. **Configuração → Schema validado → Normalização → Adapter → Tokens/overrides → ThemeProvider → Interface** — nunca centenas de edições em componentes.
2. Superfície de override = variáveis CSS `--t-*` já existentes no twenty-ui (evidência doc 01) — o core do Twenty não é editado; a cascata vence.
3. Tabelas próprias, pacotes próprios, ≤ 8 patches finos delimitados e testados (docs 03, 22).
4. Tudo publicado é versionado, imutável e endereçado por hash; fallback seguro em qualquer falha.
5. Segurança e acessibilidade como validações bloqueantes, não recomendações (docs 16, 17).
6. Identidade e assets da óDois são propriedade da óDois, entregues como dados — não commitados no core AGPL (doc 24).

## Arquitetura resumida

```text
Twenty Upstream → Fork óDois (patches finos) → o2d-upstream-bridge
→ o2d-branding-engine (core · server · front · assets · adapters · preview)
→ ThemeProvider e pontos globais → Twenty UI → módulos proprietários
```

## Componentes

| Componente | Papel | Doc |
|---|---|---|
| `o2d-branding-core` | contratos, schemas, tokens, normalização, validação, geração de overrides | 06, 09 |
| `o2d-branding-server` | persistência, resolução, versões, publicação, rollback, cache, auditoria | 07, 12, 15, 18, 19 |
| `o2d-branding-front` | provider global, anti-flash, título/favicon/login/sidebar, admin UI | 08, 13 |
| `o2d-branding-assets` | sanitização, storage, hash, fallback | 11 |
| `o2d-branding-adapters` | tokens abstratos → `--t-*` da versão instalada; compatibilidade | 10 |
| `o2d-branding-preview` | preview escopado, comparação, cenários | 14 |
| `o2d-upstream-bridge` | sync com upstream, patches, relatório de compatibilidade | 21, 22 |

## Níveis de personalização

**Nível 1 (admins):** tokens seguros e assets validados — nome, logos, favicon, cores principais, temas, raios, sombras, presets. **Nível 2 (admins técnicos):** tipografia (catálogo curado), densidade, login avançado, tokens de componente, e-mails/documentos. **Nível 3 (mantenedores óDois):** providers, patches, adapters, manifest, build — nunca editável por clientes. (doc 04 §3)

## Principais decisões (propostas)

D1 cascata CSS, sem editar CSS do upstream · D2 tabelas próprias `o2dBranding*` · D3 admin via Twenty App (fallback patch de rota) · D4 artefato pré-compilado por versão (hash) · D5 adapter selecionado em build · D6 assets só via provider · D7 sem custom CSS de cliente (B+D na análise da Etapa 16). (doc 05 §5)

## Riscos principais

Arquivos Enterprise no caminho do custom domain (JUR-2, doc 24 §4) · flash de tema em multi-tenant 1ª visita (OQ-08-1, doc 08 §4) · deprecação de settings tabs para Apps (OQ-13-1) · evolução dos tokens upstream (mitigado por adapter + bridge + Argos) · fronteira AGPL×proprietário (JUR-1).

## Fases

1 Fundação (tokens/schemas/adapter) → 2 Identidade óDois estática → 3 Admin + persistência → 4 Preview + versões → 5 Workspace/domínio → 6 Upstream bridge automatizado → 7 White-label avançado (e-mails, documentos, PWA). (doc 26)

## Índice

| Doc | Conteúdo |
|---|---|
| [00](00-project-analysis.md) | Análise do projeto atual (evidências) |
| [01](01-current-visual-architecture.md) | Arquitetura visual atual do Twenty |
| [02](02-fork-diff-analysis.md) | Inventário do fork × upstream |
| [03](03-impact-map.md) | Mapa de impacto |
| [04](04-functional-spec.md) | Especificação funcional + níveis + custom CSS |
| [05](05-target-architecture.md) | Arquitetura alvo |
| [06](06-branding-core-spec.md) | Core: contratos, schemas, validações |
| [07](07-branding-server-spec.md) | Server: persistência, publicação, cache |
| [08](08-branding-front-spec.md) | Front: provider, bootstrap, anti-flash |
| [09](09-token-system.md) | Sistema de tokens (real + abstrato) |
| [10](10-twenty-adapters.md) | Adapters por versão |
| [11](11-asset-manager.md) | Asset manager |
| [12](12-workspace-and-domain-resolution.md) | Resolução workspace/domínio |
| [13](13-admin-interface.md) | Interface administrativa |
| [14](14-preview-and-publication.md) | Preview e publicação |
| [15](15-versioning-and-rollback.md) | Versionamento e rollback |
| [16](16-accessibility.md) | Acessibilidade |
| [17](17-security.md) | Segurança |
| [18](18-data-model.md) | Modelo de dados |
| [19](19-api-contracts.md) | Contratos de API |
| [20](20-event-contracts.md) | Contratos de eventos |
| [21](21-upstream-bridge.md) | Upstream bridge |
| [22](22-patch-strategy.md) | Estratégia de patches |
| [23](23-visual-test-strategy.md) | Testes visuais e catálogo |
| [24](24-license-analysis.md) | Licenças e propriedade intelectual |
| [25](25-observability-and-performance.md) | Observabilidade e desempenho |
| [26](26-implementation-roadmap.md) | Roadmap de implementação |
| [27](27-open-questions.md) | Perguntas em aberto |
