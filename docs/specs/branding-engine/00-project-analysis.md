# 00 — Análise do Projeto Atual

> **Status:** inventário factual, base para todo o pacote `branding-engine`. Levantado em 2026-08-05 diretamente do repositório. Nenhum código foi implementado ou alterado.

## 1. Identificação do repositório

| Item | Fato | Evidência |
|---|---|---|
| Monorepo | Nx workspace + Yarn 4 (`yarn@4.13.0`), Node `^24.5.0` | `package.json` raiz (`packageManager`, `engines`), `nx.json` |
| Licença raiz | AGPL-3.0 com exceção comercial por arquivo | `LICENSE` (preâmbulo: arquivos marcados `/* @license Enterprise */` seguem licença comercial) |
| Fork? | **Sim, fork de distribuição**: `origin = https://github.com/ahs-pimentel/twenty` (fork de `twentyhq/twenty`). Não há remote `upstream` configurado no clone | `git remote -v` |
| Branch principal | `main` | `git branch -a` |
| Commit base do upstream | `538b1808` — "feat(dpa): self-serve Data Processing Agreement generator (#22243)", 2026-06-27 — último commit vindo do upstream antes das adições óDois | `git log --oneline` |
| Divergência atual do fork | **Somente documentação**: `docs/specs/proposal-module/` (17 docs) e `docs/specs/ai-hub-module/` (26 docs), mergeados via PR #1. Zero alterações em código, assets, temas ou pipelines | `git log`, doc 02 |
| Versão do Twenty | **Não é versionada no código**: `packages/twenty-server/package.json` e `twenty-front/package.json` não têm campo `version`. A versão de runtime vem da env `APP_VERSION` (`isEnvOnly`, validada por `@IsTwentySemVer`) e é exposta em `clientConfig.appVersion` | `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts:1783-1790`; `.../client-config/services/client-config.service.ts:159` |
| Único pacote com versão | `twenty-ui@1.0.0-alpha.1` | `packages/twenty-ui/package.json:3` |

**Implicação direta para o Branding Engine:** a "versão instalada do Twenty" deve ser identificada por **commit base do upstream + `APP_VERSION` de runtime**, e é isso que os adapters (doc 10) devem registrar — não uma tag npm.

## 2. Estrutura do monorepo (pacotes existentes)

`packages/`: `create-twenty-app`, `twenty-apps`, `twenty-claude-skills`, `twenty-cli`, `twenty-client-sdk`, `twenty-codex-plugin`, `twenty-companion`, `twenty-docker`, `twenty-docs`, `twenty-e2e-testing`, `twenty-emails`, `twenty-front`, `twenty-front-component-renderer`, `twenty-oxlint-rules`, `twenty-sdk`, `twenty-server`, `twenty-shared`, `twenty-ui`, `twenty-utils`, `twenty-website`, `twenty-zapier`.

Dos caminhos sugeridos na missão: `twenty-front/`, `twenty-ui/`, `twenty-server/`, `twenty-shared/`, `twenty-apps/` e `twenty-front-component-renderer/` **existem todos**.

| Pacote | Papel relevante para branding |
|---|---|
| `twenty-ui` | Design system: tokens CSS `--t-*` (`src/theme-constants/theme-{light,dark}.css`), `ThemeProvider` com `overrides`, componentes Linaria/CSS Modules, ícones de marca (`twenty-star.svg`) |
| `twenty-front` | App React 18 + Vite + Jotai; providers globais (`AppRouterProviders`), login, sidebar, título, favicon, manifest PWA |
| `twenty-server` | NestJS: workspace entity (logo/subdomain/customDomain), resolução por domínio, storage de arquivos, e-mails, feature flags, billing/enterprise |
| `twenty-shared` | Utilitários compartilhados (`getImageAbsoluteURI`, `FileFolder`, `FeatureFlagKey`, `ReservedSubdomains`) |
| `twenty-emails` | Templates React Email com marca Twenty hardcoded |
| `twenty-apps` + `twenty-sdk` | Plataforma de Apps: um App declara objetos, campos, views, front-components, logic functions, navigation items, roles — relevante como veículo de instalação do módulo admin |
| `twenty-front-component-renderer` | Renderer remote-dom para front-components de Apps (sandbox), com próprio Storybook; `ThemeProvider colorScheme="light"` no preview |
| `twenty-e2e-testing` | Playwright E2E (screenshots pós-teste sem baseline) |
| `twenty-docker` | Dockerfile + `entrypoint.sh` que injeta `window._env_` via `packages/twenty-front/scripts/inject-runtime-env.sh` |

## 3. Stack e sistema visual

- **Frontend:** React 18, TypeScript, Vite, Jotai, Linaria + CSS Modules (a migração afastou Emotion como fonte de tema), `@dr.pogodin/react-helmet` para head. Lingui para i18n.
- **Sistema de temas:** variáveis CSS `--t-*` definidas em `.light`/`.dark` (`twenty-ui/src/theme-constants/theme-{light,dark}.css`, ~1000 linhas cada), espelho TS `themeCssVariables.ts`, provider `twenty-ui/src/theme-constants/ThemeProvider.tsx` (aceita `overrides` escopados). Objetos legados `THEME_LIGHT/THEME_DARK` ainda exportados (uso residual: `useStripeAppearance.ts:30`).
- **Provider global:** `BaseThemeProvider` (`twenty-front/src/modules/ui/theme/components/BaseThemeProvider.tsx`) montado em `AppRouterProviders.tsx:46`; preferência do usuário: Jotai + localStorage + `workspaceMember.colorScheme`.
- Detalhamento completo com evidências: **doc 01**.

## 4. Identidade e assets atuais

- Título: `<title>Twenty</title>` (`index.html:40`) + fallback `'Twenty'` em `src/utils/title-utils.ts:61-63` via `PageTitle`.
- Favicon: estático em `index.html:6-11`; **dinâmico por workspace** em `PageFavicon.tsx` (usa `workspacePublicData.logo`).
- Logos: PNG launcher (`public/images/icons/android/android-launchericon-192-192.png`) como logo do app (`auth/components/Logo.tsx:62`); default remoto `https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png` (`DefaultWorkspaceLogo.ts`, duplicado em `twenty-emails`).
- Manifest PWA: `public/manifest.json` estático (`name/short_name: "Twenty"`, ~90 ícones android/ios/windows11).
- Metadados sociais: og:/twitter: hardcoded em `index.html:16-30`.
- Fontes: Google Fonts CDN (Inter, DM Mono) em `index.html:31-38`.

## 5. Backend relevante

- **Workspace entity** (`core.workspace`): `displayName`, `logo` (deprecated), `logoFileId`→`FileEntity`, `subdomain` (unique), `customDomain` (unique, nullable), `isCustomDomainEnabled` — `packages/twenty-server/src/engine/core-modules/workspace/workspace.entity.ts:74-90,236-272`.
- **Resolução por domínio**: query pública `getPublicWorkspaceDataByDomain` (`workspace.resolver.ts:380-441`) → `WorkspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace`; domínio custom via Cloudflare (`custom-domain-manager`, `dns-manager`, `cloudflare`), **gated por billing entitlement** `BillingEntitlementKey.CUSTOM_DOMAIN` (`custom-domain-manager.service.ts:36-49`).
- **Storage**: `file-storage.service.ts` com drivers `local`/`s3` (fábrica por `STORAGE_TYPE`; envs `STORAGE_S3_*` — nomes apenas, valores não copiados); URLs assinadas por JWT (`file-url.service.ts:33-60`, `${SERVER_URL}/file/${fileFolder}/${fileId}?token=...`); pastas em `FileFolder` (`twenty-shared/src/types/FileFolder.ts`) incluindo `WorkspaceLogo` (legado), `CorePicture` (atual para logo), `PublicAsset`.
- **Upload de logo**: mutation `uploadWorkspaceLogo` (`file-core-picture.resolver.ts:36-56`, guard `SettingsPermissionGuard(PermissionFlagType.WORKSPACE)`).
- **E-mails**: 12 templates em `packages/twenty-emails/src/emails/`; layout `BaseEmail.tsx` com `<Logo/>` **hardcoded** (`https://app.twenty.com/images/icons/...`, `components/Logo.tsx:9-15`) e `Footer.tsx` com links/texto Twenty; logo de workspace aparece só no corpo de 2 templates (`send-invite-link`, `validate-approved-access-domain`). Envio: `EmailService.send` → fila BullMQ → driver SMTP/logger.
- **Feature flags**: enum `FeatureFlagKey` (`twenty-shared/src/types/FeatureFlagKey.ts`, 9 chaves; nenhuma de branding), tabela `core.featureFlag` por workspace, flags públicas (Lab) em `public-feature-flag.const.ts`.

## 6. Enterprise e licenças (resumo — análise completa no doc 24)

- Sem diretório `ee/`; **299 arquivos** marcados `/* @license Enterprise */` (242 server, 52 front, 5 shared). Clusters relevantes para branding: **custom domain no front** (`settings/domains/components/SettingsCustomDomain.tsx`, `useSettingsCustomDomain.ts`), SSO, row-level permissions, usage.
- Módulos `enterprise/` (validação de chave) e `billing/` (entitlements, ex.: `CUSTOM_DOMAIN`) no server.
- `twenty-companion`: MIT (Copyright Recall.ai). `twenty-ui`: AGPL-3.0 com a mesma exceção Enterprise.

## 7. Testes e CI

- Storybook: `twenty-front/.storybook` (escopos pages/modules/performance/ui-docs), `twenty-ui/.storybook` (addon-a11y com `test: 'error'`), `twenty-front-component-renderer/.storybook`.
- Testes de stories: Vitest browser mode + Playwright chromium (`vitest.config.ts` de front e ui).
- **Regressão visual: Argos CI** (`@argos-ci/storybook`; workflows `ci-front.yaml`, `ci-ui.yaml`, `visual-regression-dispatch.yaml`). Sem Chromatic/Percy.
- E2E: `twenty-e2e-testing` (Playwright; `ci-e2e-main.yaml`); screenshots de artefato sem comparação.
- Outros workflows notáveis: `ci-cross-version-upgrade.yaml` (upgrade entre versões), `cd-deploy-main.yaml`/`cd-deploy-tag.yaml` (deploy), `ci-emails.yaml`, `ci-twenty-apps.yaml`.

## 8. Buscas exigidas pela missão — resultado

| Termo | Resultado |
|---|---|
| `ThemeProvider` / `BaseThemeProvider` / `ThemeContext` | Encontrados — doc 01 §2 |
| `themeCssVariables` / `theme-light.css` / `theme-dark.css` | Encontrados em `twenty-ui/src/theme-constants/` |
| `colorScheme` | `useColorScheme.ts`, `persistedColorSchemeState.ts`, campo em `workspaceMember` |
| `styled-components` | Não é a base atual; estilização por Linaria + CSS Modules com `var(--t-*)` (Emotion residual em legado) |
| `logo` / `favicon` / `manifest` / `document.title` | Doc 01 §3 (favicon dinâmico via `PageFavicon`, título via Helmet) |
| `sidebar` / `navigation` | `modules/ui/navigation/navigation-drawer/**` — doc 01 §5 |
| `login` / `sign-in` | `pages/auth/SignInUp*.tsx`, `modules/auth/**` — doc 01 §4 |
| `workspace logo` / `workspace name` | `WorkspaceLogoUploader.tsx`, `DefaultWorkspaceLogo.ts`, `DefaultWorkspaceName.ts` |
| `email template` | `packages/twenty-emails/src/emails/**` |
| `branding` / `white-label` | **Nenhum módulo de white-label existe**; menções apenas incidentais (docs de usuário "workspace name and branding", changelog do codex-plugin) |
| `custom domain` | `core-modules/domain/**` + Cloudflare + entitlement de billing |
| `Storybook` | 3 pacotes com Storybook; Argos para visual |

## 9. Lacunas identificadas (o que NÃO existe hoje)

1. Nenhum mecanismo para alterar **cores/tema por workspace ou por instância** — os tokens `--t-*` são estáticos nos CSS do `twenty-ui`.
2. Nenhuma configuração de **título/manifest/metadados** — todos estáticos no `index.html`/`manifest.json`.
3. Logo default, nome default e ícones de marca **hardcoded** (constantes e PNGs).
4. E-mails com **marca Twenty fixa** no header/footer.
5. Nenhum conceito de **versão/publicação/rollback de configuração visual**, nem auditoria disso.
6. Nenhum **preview** de tema.
7. Nenhuma feature flag ou entitlement de "branding".
8. Nenhum processo formalizado de **sincronização com upstream** no fork (sem remote upstream, sem branch de integração, sem relatório de compatibilidade).
9. Fontes servidas por **CDN externo** (Google Fonts) — ponto de atenção para white-label e privacidade (LGPD/GDPR).

## 10. Ativos reutilizáveis (fundação favorável)

1. Sistema `--t-*` + `ThemeProvider.overrides` — superfície de override pronta (doc 01 §8).
2. `getPublicWorkspaceDataByDomain` + `workspacePublicDataState` + `PageFavicon`/`Logo secondaryLogo` — canal domínio→branding parcial já existente.
3. Infra de arquivos com URLs assinadas + `FileFolder.PublicAsset` — base do Asset Manager.
4. Plataforma de Apps (objetos, front-components, navigation items, roles) — veículo possível para a UI administrativa sem patch no core.
5. Argos + Storybook + Playwright — fundação dos testes visuais do upstream bridge.
6. `inject-runtime-env.sh` — precedente de reescrita do `index.html` no boot do container (canal para tokens críticos anti-flash).
7. Guards de permissão (`SettingsPermissionGuard`, `PermissionFlagType.WORKSPACE`) e auditoria via eventos existentes como referência de padrão.
