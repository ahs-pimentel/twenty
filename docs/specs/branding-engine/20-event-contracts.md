# 20 — Contratos de Eventos Internos

> **Status:** especificação proposta — nenhum código implementado.
> Convenções alinhadas ao padrão já especificado nos pacotes óDois (`docs/specs/proposal-module`, `docs/specs/ai-hub-module`): eventos versionados, `correlationId` obrigatório, consumidores idempotentes.

## 1. Convenções gerais

- **Nomenclatura**: `branding.<agregado>.<fato_no_passado>` (fatos, nunca comandos).
- **Envelope** (comum a todos):

```json
{
  "eventId": "uuid",
  "eventType": "branding.published",
  "eventVersion": "1.0",
  "occurredAt": "ISO-8601",
  "workspaceId": "uuid",
  "correlationId": "uuid",
  "causationId": "uuid | null",
  "actor": { "type": "user | system | upstream-bridge", "id": "uuid | slug" },
  "payload": { }
}
```

- **Transporte**: fila interna do próprio módulo (BullMQ, já usado pelo Twenty server) para efeitos assíncronos; tabela `BrandingAuditEvent` (doc 18) como registro durável — o evento é gravado na mesma transação da mudança de estado (outbox) e então enfileirado.
- **Idempotência**: consumidores deduplicam por `eventId`; efeitos como invalidação de cache são naturalmente idempotentes; envio de notificações usa chave `eventId` com TTL.
- **Retry**: backoff exponencial (5 tentativas), depois DLQ com alerta de observabilidade (doc 25).
- **Versionamento**: mudanças aditivas mantêm `eventVersion` minor; remoção/renome de campo exige nova major e período de convivência dos consumidores.

## 2. Catálogo de eventos

| Evento | Produtor | Consumidores | Payload principal |
|---|---|---|---|
| `branding.configuration.created` | API (POST /configurations) | auditoria | `configurationId`, `name`, `basePreset` |
| `branding.configuration.updated` | API (PATCH) | auditoria, preview (invalida rascunho renderizado) | `configurationId`, `changedPaths[]`, `draftVersion` |
| `branding.validation.started` | serviço de validação | auditoria | `configurationId`, `versionId`, `validationRunId` |
| `branding.validation.completed` | serviço de validação | API (transição p/ `READY_TO_PUBLISH`), auditoria | `validationRunId`, `result: passed`, `warnings[]` |
| `branding.validation.failed` | serviço de validação | API (transição p/ `VALIDATION_FAILED`), notificação ao autor | `validationRunId`, `errors[]` (código, token, valores medidos) |
| `branding.preview.generated` | serviço de preview | auditoria | `configurationId`, `versionId`, `previewToken` (hash, não o token em claro), `expiresAt` |
| `branding.version.created` | serviço de versionamento | auditoria | `versionId`, `number`, `basedOnVersion`, `snapshotHash` |
| `branding.publication.requested` | API (POST /publish) | pipeline de publicação | `versionId`, `requestedBy` |
| `branding.published` | pipeline de publicação | **cache (invalidação por workspace+domínio)**, auditoria, webhook opcional | `versionId`, `number`, `workspaceId`, `domains[]`, `artifactHash`, `adapterVersion`, `twentyVersion` |
| `branding.publication.failed` | pipeline de publicação | notificação, auditoria | `versionId`, `stage`, `error` |
| `branding.rollback.requested` | API (POST /rollback) | pipeline de publicação | `fromVersion`, `toVersion`, `requestedBy` |
| `branding.rolled_back` | pipeline de publicação | cache, auditoria, notificação | `newVersionId` (nova versão baseada na anterior — doc 15), `restoredFromVersion` |
| `branding.asset.uploaded` | Asset Manager | pipeline de validação de asset, auditoria | `assetId`, `type`, `format`, `bytes`, `sha256` |
| `branding.asset.rejected` | pipeline de validação de asset | notificação ao autor, auditoria | `assetId`, `reason` (código: formato, dimensão, SVG-sanitização, conteúdo) |
| `branding.adapter.incompatible` | validação de compatibilidade / upstream bridge | bloqueio de publicação, alerta mantenedores | `adapterVersion`, `twentyVersion`, `missingTokens[]`, `renamedTokens[]`, `severity` |
| `branding.upstream.sync_started` | upstream bridge (CI) | auditoria | `upstreamRef`, `baseRef`, `syncRunId` |
| `branding.upstream.sync_completed` | upstream bridge (CI) | relatório de compatibilidade (doc 21), notificação mantenedores | `syncRunId`, `newTwentyVersion`, `tokenDiff` (added/removed/renamed), `visualTestResult` |
| `branding.upstream.conflict_detected` | upstream bridge (CI) | notificação mantenedores, bloqueio do pipeline de release | `syncRunId`, `conflictFiles[]`, `patchesAffected[]` |

## 3. Regras por evento

### `branding.published` (o evento crítico)
- **Ordem**: só é emitido após o artefato (CSS vars + manifest de assets) estar persistido e endereçável por hash. Consumidor de cache invalida chaves `branding:current:{workspaceId}` e `branding:domain:{host}` — clientes passam a receber a nova versão; os que ainda têm cache local versionado detectam divergência de hash no próximo bootstrap (doc 08/12).
- **Idempotência**: republicar o mesmo `versionId` não gera segundo evento (a transição de estado `READY_TO_PUBLISH → PUBLISHED` só ocorre uma vez; ver doc 15).

### `branding.validation.*`
- `started/completed/failed` compartilham `validationRunId`; um novo run cancela logicamente o anterior (consumidores ignoram runs obsoletos comparando timestamps).

### `branding.upstream.*`
- Produzidos por processo de CI, não pelo servidor de runtime; gravados via API interna autenticada por token de serviço (doc 17). `correlationId` = `syncRunId` para amarrar sync → relatório → publicação de nova versão de adapter.

## 4. O que NÃO é evento

- Leituras de branding (GET /branding/current) — alto volume, apenas métricas (doc 25).
- Mudanças de rascunho campo-a-campo — agregadas em `configuration.updated` com `changedPaths[]` (evita ruído de auditoria); o diff completo vive no snapshot da versão.
