# 07 — `o2d-branding-server` (persistência, resolução, publicação, cache)

> **Status:** proposta — nada implementado. Módulo NestJS novo dentro de `packages/twenty-server` (padrão dos core-modules existentes), com tabelas próprias — nenhuma tabela do Twenty é alterada.

## 1. Responsabilidades

Persistência das configurações; resolução por workspace e por domínio; versionamento; publicação; rollback; permissões; auditoria; orquestração do armazenamento de assets; disponibilização da configuração ao frontend; cache; invalidação de cache.

## 2. Estrutura proposta

```text
packages/twenty-server/src/o2d/branding/          # namespace o2d isolado
├── branding.module.ts
├── controllers/branding-public.controller.ts     # GET /branding/current (REST, público)
├── resolvers/branding.resolver.ts                # GraphQL autenticado (admin)
├── services/
│   ├── branding-configuration.service.ts         # CRUD + rascunho
│   ├── branding-resolution.service.ts            # domínio/workspace → artefato
│   ├── branding-publication.service.ts           # validação, publish, rollback
│   ├── branding-version.service.ts               # snapshots imutáveis
│   ├── branding-asset.service.ts                 # doc 11 (orquestra FileStorageService)
│   ├── branding-cache.service.ts                 # Redis + invalidação
│   └── branding-audit.service.ts                 # outbox → BullMQ
├── entities/                                     # doc 18
└── jobs/branding-validation.job.ts               # validação completa assíncrona
```

Racional de localização: dentro do twenty-server para reutilizar injeção de `FileStorageService`, guards, Redis e BullMQ **sem expor nada disso por rede**; isolado sob `src/o2d/` para o diff com upstream permanecer trivial (diretório inteiro é adição).

## 3. Resolução (contrato com doc 12)

- `resolveByOrigin(origin)`: host → workspace (reutilizando `WorkspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace`, evidência doc 01 §6) → branding publicado → artefato. Cadeia de prioridade e casos de borda no doc 12.
- `resolveByWorkspace(workspaceId)`: usado pós-login e pela admin UI.
- Ambos retornam `PublishedBrandingArtifact { hash, cssLight, cssDark, assets, meta }` ou o artefato default da distribuição.

## 4. Publicação e rollback (contrato com doc 15)

- Máquina de estados do doc 15 aplicada server-side; transições válidas são as únicas mutações possíveis (repositório não expõe `update` livre de status).
- Publicar: valida (core doc 06 §4) → gera artefato via adapter → persiste `BrandingVersion` imutável + `BrandingPublication` → troca ponteiro `publishedVersionId` em transação → grava auditoria (outbox) → invalida cache → emite `branding.published`.
- Rollback: sempre **nova versão** baseada na antiga (nunca sobrescreve); mesma trilha de validação (o adapter atual pode ter mudado desde a versão restaurada).

## 5. Cache e invalidação

| Camada | Chave | TTL | Invalidação |
|---|---|---|---|
| Redis | `o2d:branding:ws:{workspaceId}` → artefato publicado | 24h | no `branding.published`/`rolled_back` |
| Redis | `o2d:branding:host:{hostname}` → workspaceId + hash | 1h | idem + eventos de mudança de domínio (`CUSTOM_DOMAIN_ACTIVATED/DEACTIVATED`, já emitidos por `custom-domain-manager.service.ts` — o módulo escuta) |
| HTTP | `ETag = hash` no `GET /branding/current`; `Cache-Control: public, max-age=60, stale-while-revalidate=600` | — | hash muda a cada publicação |
| Cliente | cache local versionado por hash (doc 08 §4) | — | comparação de hash no bootstrap |

Regra: invalidação **precede** a emissão do evento externo; leituras nunca servem artefato de outro workspace (chave inclui o ID; testes de isolamento — cenários 3/16, doc 23).

## 6. Permissões e auditoria

- Guards reutilizando o padrão existente (`SettingsPermissionGuard`, evidência: `file-core-picture.resolver.ts:36-56`): MVP usa `PermissionFlagType.WORKSPACE`; flag dedicado `BRANDING` como evolução (OQ-17-1). Matriz completa de RBAC no doc 17.
- Toda mutação grava `BrandingAuditEvent` na mesma transação (outbox) — doc 18/20.

## 7. Assets

O server orquestra; regras e pipeline no doc 11. Pontos fixos: uso do `FileStorageService` existente (drivers local/S3 — evidência `file-storage-driver.factory.ts:26-96`), novo `FileFolder.BrandingAsset` (adição aditiva ao enum em `twenty-shared/src/types/FileFolder.ts` + config em `file-folder.interface.ts`), URLs públicas estáveis por hash (assets publicados são imutáveis ⇒ cache infinito), sem token de expiração (mesmo tratamento de `PublicAsset`).

## 8. Interações com o restante do Twenty

| Dependência | Uso | Alteração no core? |
|---|---|---|
| `WorkspaceDomainsService` | origem → workspace | não |
| `FileStorageService` / `FileUrlService` | assets | não (enum +1 valor) |
| Redis (`CacheStorageService`) | cache | não |
| BullMQ (`MessageQueue`) | validação assíncrona, auditoria, e-mails futuros | não |
| Guards/permissões | RBAC | não (flag novo é aditivo) |
| `getPublicWorkspaceDataByDomain` | inalterado no MVP; Fase 5 avalia acrescentar `brandingHash` ao DTO (patch pequeno, OQ-12-1) | opcional |

## 9. Migrations

Somente **criação** das tabelas `o2dBranding*` (doc 18) via instance command padrão do repositório (`database:migrate:generate`, tipo fast), com `up`/`down` completos. Nenhuma migration toca tabelas existentes. Nenhuma migration é executada nesta etapa.
