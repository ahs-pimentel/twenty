# 03 — Mapa de Impacto

> **Status:** proposta — nada implementado. Classifica cada ponto do sistema atual quanto ao que o Branding Engine exigirá. Caminhos são reais (evidências nos docs 00/01).

## 1. Legenda

- **Ação**: Reutilizar / Alterar / Estender / Desacoplar / Substituir / Criar / Manter intacto.
- **Prioridade**: MVP (obrigatória) / Recomendada / Futura / Dívida técnica / Não necessária / Evitar.
- Colunas de impacto: acoplamento (baixo/médio/alto), conflito upstream (risco de merge conflict futuro), build/runtime/banco, migration, licença.

## 2. Pontos existentes do core

### 2.1 Sistema de temas

| Ponto | `packages/twenty-ui/src/theme-constants/` (`theme-light.css`, `theme-dark.css`, `ThemeProvider.tsx`, `themeCssVariables.ts`) |
|---|---|
| Responsabilidade atual | Fonte da verdade dos tokens `--t-*`; alternância `.light`/`.dark`; overrides escopados |
| Ação | **Reutilizar (manter intacto)** — o Branding Engine injeta um bloco de variáveis com maior precedência na cascata (via provider próprio), sem editar esses arquivos |
| Justificativa | Editar os CSS do upstream criaria conflito permanente; a cascata CSS já permite sobrepor |
| Acoplamento | Baixo (contrato = nomes das variáveis; monitorado pelo adapter, doc 10) |
| Conflito upstream | Nulo (sem edição) · Build: nenhum · Runtime: +1 stylesheet dinâmico · Banco/migration: não · Licença: AGPL intacto |
| Prioridade | **MVP** |

### 2.2 Provider raiz do app

| Ponto | `packages/twenty-front/src/modules/app/components/AppRouterProviders.tsx` (monta `BaseThemeProvider`:46, `UserThemeProviderEffect`:60, `PageTitle`:72, `PageFavicon`:73) |
|---|---|
| Ação | **Alterar (patch fino)** — envolver a árvore com `O2dBrandingProvider` (1 import + 1 wrapper) |
| Alternativa sem alteração | Nenhuma equivalente: Apps não podem envolver a raiz; é o único patch estrutural do front |
| Acoplamento | Médio (arquivo mexido pelo upstream com frequência moderada) · Conflito upstream: médio, mitigado por patch mínimo (doc 22) |
| Build/runtime: neutro · Banco: não · Licença: arquivo AGPL → o patch permanece AGPL (doc 24) |
| Prioridade | **MVP** |

### 2.3 `index.html` + injeção de runtime

| Ponto | `packages/twenty-front/index.html` (título, favicon, og-tags, fontes, CSS crítico) + `packages/twenty-front/scripts/inject-runtime-env.sh` |
|---|---|
| Ação | **Estender** — adicionar bloco `<!-- BEGIN/END: O2D Branding -->` reescrito no boot (mesmo padrão do `window._env_`) com tokens críticos inline + título/favicon/manifest da distribuição |
| Justificativa | Anti-flash (doc 08 §4): valores certos antes do primeiro paint |
| Acoplamento | Baixo · Conflito upstream: baixo (blocos delimitados) · Build: neutro · Runtime: neutro · Migration: não · Licença: AGPL |
| Prioridade | **MVP** (versão estática da distribuição); reescrita por domínio é **Recomendada** (Fase 5) |

### 2.4 Título e favicon dinâmicos

| Ponto | `src/utils/title-utils.ts:61-63` (fallback `'Twenty'`), `PageTitle.tsx`, `PageFavicon.tsx`, `NotFound.tsx:49` |
|---|---|
| Ação | **Estender** — fallback passa a ler do `BrandingProvider` (`brand.productName`); `PageFavicon` já é dinâmico, passa a preferir asset `favicon` do branding sobre `workspacePublicData.logo` |
| Acoplamento | Baixo · Conflito: baixo (funções pequenas) · Prioridade | **MVP** |

### 2.5 Constantes default de marca

| Ponto | `DefaultWorkspaceLogo.ts` (front + emails), `DefaultWorkspaceName.ts`, `auth/components/Logo.tsx:62` |
|---|---|
| Ação | **Desacoplar** — constantes viram *fallback da distribuição* resolvido pelo BrandingProvider/assets; os arquivos originais passam a ler de um único ponto |
| Risco | Baixo; três arquivos pequenos · Conflito: baixo · Prioridade | **MVP** |

### 2.6 Login

| Ponto | `pages/auth/SignInUp.tsx`, `SignInUpV2.tsx`, `modules/auth/components/{Logo,Title}.tsx`, `SignInUpV2StandardContent.tsx` |
|---|---|
| Ação | **Estender** — logo primário, título de boas-vindas, imagem/fundo e mensagem legal vêm do branding resolvido por domínio (o canal `workspacePublicDataState` já existe); layout alternativo do login é Futura (Fase 7) |
| Acoplamento | Médio · Conflito: médio (upstream evolui auth) — mitigação: mudanças concentradas em `Logo.tsx` e no título · Prioridade | **MVP** parcial (logo+nome), **Recomendada** (imagem/disposição) |

### 2.7 Sidebar

| Ponto | `modules/ui/navigation/navigation-drawer/**` (largura via `--navigation-drawer-width`, cores via `--t-*`) |
|---|---|
| Ação | **Manter intacto** — personalização de cores/densidade da sidebar acontece por tokens; largura default configurável via token `layout.sidebar.width` mapeado para `NavigationDrawerConstraints` é **Futura** |
| Prioridade | Não necessária no MVP (tokens cobrem) |

### 2.8 Manifest PWA e metadados sociais

| Ponto | `public/manifest.json`, og-tags em `index.html:16-30` |
|---|---|
| Ação | **Substituir por geração** — manifest servido dinamicamente (ou reescrito no boot do container) a partir do branding da distribuição; og-tags idem |
| Acoplamento | Baixo · Conflito: baixo · Prioridade | **Recomendada** (Fase 2 estático; por domínio na Fase 7) |

### 2.9 E-mails

| Ponto | `packages/twenty-emails/src/components/{BaseEmail,Logo,Footer,WhatIsTwenty}.tsx`; call-sites no server (ex.: `workspace-invitation.service.ts:317-356`) |
|---|---|
| Ação | **Estender** — `BaseEmail` recebe `branding` (logo URL, nome, footer) com default = valores atuais; o server injeta o branding resolvido do workspace ao renderizar. Assuntos hardcoded (`Join your team on Twenty`) parametrizados pelo nome do produto |
| Acoplamento | Médio (props novas em pacote compartilhado) · Conflito: médio · Migration: não · Prioridade | **Futura** (Fase 7); MVP mantém e-mails como estão |

### 2.10 Resolução por domínio

| Ponto | `workspace.resolver.ts:380-441` (`getPublicWorkspaceDataByDomain`), `workspace-domains.service.ts`, `custom-domain-manager.service.ts` |
|---|---|
| Ação | **Reutilizar + Estender** — o endpoint público de branding (doc 19 `GET /branding/current`) usa o mesmo mecanismo de origem→workspace; não se altera a query existente no MVP. Evolução: acrescentar campo `branding` à `PublicWorkspaceDataDTO` (patch pequeno) OU endpoint REST próprio (sem patch) — decisão OQ-12-1 |
| Licença | `SettingsCustomDomain.tsx` e hooks de custom domain são `/* @license Enterprise */` + entitlement de billing — **restrição comercial a validar** (doc 24 §5) |
| Prioridade | **MVP** (workspace), **Fase 5** (domínio) |

### 2.11 Storage de arquivos

| Ponto | `file-storage/**`, `file-url.service.ts`, `FileFolder` (`twenty-shared/src/types/FileFolder.ts`), `file.controller.ts` |
|---|---|
| Ação | **Reutilizar** — Asset Manager (doc 11) usa `FileStorageService` e o padrão de URL assinada; **Estender**: novo valor `BrandingAsset` no enum `FileFolder` (mudança aditiva em `twenty-shared` + config de pasta em `file-folder.interface.ts:14-69`) |
| Migration | Não (enum é código; arquivos vão ao storage) · Conflito: baixo (adição de linha) · Prioridade | **MVP** |

### 2.12 Permissões

| Ponto | `SettingsPermissionGuard`, `PermissionFlagType` (padrão usado por `uploadWorkspaceLogo`) |
|---|---|
| Ação | **Estender** — novo flag `BRANDING` (ou reuso de `WORKSPACE` no MVP — decisão OQ-17-1) |
| Prioridade | **MVP** (reuso), **Recomendada** (flag próprio) |

### 2.13 Objetos legados de tema

| Ponto | `twenty-ui/src/theme/constants/THEME_LIGHT/THEME_DARK` (uso residual em `useStripeAppearance.ts:30`) |
|---|---|
| Ação | **Manter intacto** — não é superfície de branding; se o upstream removê-los, nada quebra no engine |
| Prioridade | Não necessária |

### 2.14 O que deve ser evitado

- Editar `theme-light.css`/`theme-dark.css` do `twenty-ui` — **Evitar** (conflito permanente).
- Duplicar componentes do Twenty (login paralelo, sidebar paralela) — **Evitar**.
- Espalhar `style=`/CSS por componente — **Evitar**.
- Alterar `manifest.json` commitado com a marca óDois — **Evitar** (usar geração; manter o arquivo do upstream intacto).
- Fork dos templates de e-mail inteiros — **Evitar** (estender via props).

## 3. Componentes novos (Criar)

| Componente | Conteúdo | Banco | Migration | Prioridade |
|---|---|---|---|---|
| `o2d-branding-core` (pacote novo) | schemas, tokens abstratos, normalização, derivação, validação, geração de overrides | não | não | MVP |
| `o2d-branding-server` (módulo NestJS novo) | entidades doc 18, resolução, versionamento, publicação, cache, API doc 19 | **sim — tabelas próprias `o2dBranding*` no schema `core`** | sim (novas tabelas apenas; nenhuma tabela do Twenty alterada) | MVP (Fase 3) |
| `o2d-branding-front` | `O2dBrandingProvider`, aplicação de overrides, tela administrativa | não | não | MVP |
| `o2d-branding-assets` | pipeline de validação/sanitização + manifesto de assets | storage | não | MVP |
| `o2d-branding-adapters` | adapter da versão instalada + compatibilidade | não | não | MVP |
| `o2d-branding-preview` | preview escopado (usa `ThemeProvider` com `overrides`/`applyToRoot=false`) | não | não | Fase 4 |
| `o2d-upstream-bridge` | processo + CI de sincronização, relatório de compatibilidade | não | não | Fase 6 (processo desde a Fase 1) |

## 4. Síntese

```text
Manter intacto:  twenty-ui (temas), navigation-drawer, storage drivers, THEME_* legados
Reutilizar:      --t-* + ThemeProvider.overrides, getPublicWorkspaceDataByDomain,
                 FileStorageService, Argos/Storybook, guards de permissão
Estender:        index.html (bloco delimitado), title-utils, PageFavicon, Logo login,
                 FileFolder (+1 valor), PublicWorkspaceDataDTO (Fase 5), BaseEmail (Fase 7)
Alterar (patch): AppRouterProviders.tsx (1 wrapper)
Desacoplar:      DefaultWorkspaceLogo/Name, logo default do Logo.tsx
Substituir:      manifest.json estático → geração (mantendo o arquivo original)
Criar:           os 7 pacotes/módulos o2d-*
Evitar:          edição dos CSS de tema, componentes duplicados, CSS espalhado,
                 fork profundo de e-mails
```

Total de arquivos do core tocados no MVP (projeção): **≤ 8** (detalhados como patches no doc 22).
