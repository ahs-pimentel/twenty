# 19 — Contratos de API

> **Status:** proposta — nada implementado.

## 1. Convenções

- **Superfície pública de runtime**: REST (cacheável por ETag/CDN) sob `/branding/*`.
- **Superfície administrativa**: os mesmos contratos podem ser expostos via GraphQL (padrão do Twenty) — os shapes abaixo valem para ambos. Decisão de trabalho OQ-19-1 (doc 27): GraphQL para admin, REST para runtime público.
- AuthN: sessão/JWT padrão do Twenty; AuthZ: matriz do doc 17 §1. Todos os erros seguem `{ error: { code, message, details[] } }`.
- Toda mutação grava auditoria e emite os eventos do doc 20; `correlationId` aceito por header e propagado.

## 2. Endpoints

### Runtime (público, sem autenticação)

`GET /branding/current`
- Objetivo: artefato publicado resolvido pela cadeia do doc 12 (Host/Origin → domínio → workspace → distribuição).
- Request: headers `Host`/`Origin`; `If-None-Match: <hash>`.
- Response 200: `{ hash, tokens: {cssLight, cssDark}, assets: {slot: {url, fallbackUrl}}, brand: {productName, shortName}, meta: {adapterVersion, twentyVersion, publishedAt} }` + `ETag`, `Cache-Control: public, max-age=60, stale-while-revalidate=600`. 304 quando não mudou.
- Erros: nunca 4xx/5xx com corpo vazio — em falha interna responde o artefato da distribuição (fallback) com header `X-O2d-Branding-Fallback: 1`.
- Idempotente, sem auditoria (métricas apenas), cache agressivo.

### Configurações (admin)

| Endpoint | Objetivo | Notas |
|---|---|---|
| `GET /branding/configurations` | listar do workspace corrente | AuthZ: VIEW; paginação padrão |
| `POST /branding/configurations` | criar (nome, basePreset) | AuthZ: EDIT; 409 nome duplicado; evento `configuration.created`; idempotência por `Idempotency-Key` |
| `GET /branding/configurations/{id}` | detalhe + rascunho + status | VIEW; 404 se de outro workspace (nunca 403 que confirme existência) |
| `PATCH /branding/configurations/{id}` | atualizar rascunho (merge parcial documentado) | EDIT (campos Nível 2 exigem EDIT_ADVANCED); lock otimista por `If-Unmodified-Since`/`draftUpdatedAt` → 409 em conflito; evento `configuration.updated` |

### Ciclo de vida

| Endpoint | Objetivo | Notas |
|---|---|---|
| `POST /branding/configurations/{id}/validate` | validação completa assíncrona | EDIT; 202 + `validationRunId`; resultado via GET detalhe ou evento; idempotente por rascunho-hash |
| `POST /branding/configurations/{id}/preview` | gerar artefato de preview do rascunho | EDIT; 201 `{previewToken, expiresAt, artifact}`; auditado; não cacheável |
| `POST /branding/configurations/{id}/publish` | publicar `READY_TO_PUBLISH` | **PUBLISH**; body `{versionNumber?, changelog}`; 409 se estado inválido; idempotente: republicar versão já publicada → 200 sem efeito; eventos `publication.requested` → `published`/`publication.failed`; invalida caches |
| `POST /branding/configurations/{id}/rollback` | nova versão baseada em anterior | PUBLISH; body `{toVersion, reason!}`; 422 se revalidação falhar (relatório no corpo); eventos `rollback.requested` → `rolled_back` |
| `POST /branding/configurations/{id}/archive` | arquivar configuração | PUBLISH; 409 se for a única ativa com domínio apontando |

### Versões

| Endpoint | Objetivo |
|---|---|
| `GET /branding/configurations/{id}/versions` | histórico (número, status, autor, data, hash, changelog resumido) |
| `GET /branding/configurations/{id}/versions/{version}` | snapshot completo + validationResult + diff contra a publicada |

Ambos VIEW, cache privado curto.

### Assets

| Endpoint | Objetivo | Notas |
|---|---|---|
| `POST /branding/assets` | upload multipart `{configurationId, slot, file}` | ASSETS; 202 `{assetId, status: processing}` → pipeline doc 11; 413 tamanho, 415 formato, 422 sanitização (motivo detalhado); rate limited; eventos `asset.uploaded`/`asset.rejected` |
| `GET /branding/assets/{id}` | metadados + URL (assinada se rascunho) | VIEW |
| `DELETE /branding/assets/{id}` | remoção lógica | ASSETS; 409 se referenciado por versão não-arquivada; auditado |

### Compatibilidade

| Endpoint | Objetivo | Notas |
|---|---|---|
| `GET /branding/compatibility` | último `CompatibilityReport` do adapter instalado | VIEW (admin) |
| `POST /branding/compatibility/validate` | disparar verificação sob demanda | Nível 3 / token de serviço do CI (bridge); 202 + relatório por evento `adapter.incompatible`/report |

## 3. Regras transversais

1. **Isolamento**: todo endpoint admin resolve o workspace da sessão; IDs de outro workspace → 404 (cenário 16, doc 23).
2. **Idempotência**: mutações aceitam `Idempotency-Key` (janela 24h); publish/rollback são naturalmente idempotentes por versão.
3. **Auditoria**: cada mutação → `BrandingAuditEvent` síncrono (outbox) — inclui ator, before/after mínimo (paths), correlationId.
4. **Cache**: apenas `GET /branding/current` é público-cacheável; endpoints admin `Cache-Control: no-store`.
5. **Erros de validação** sempre listam por token: `{ code: 'CONTRAST_BELOW_AA', tokenPath: 'text.primary', measured: 3.9, required: 4.5, mode: 'dark' }`.
