# 25 — Observabilidade e Desempenho

> **Status:** proposta — nada implementado.

## 1. Observabilidade

### Logs (estruturados, padrão do twenty-server)

| Evento | Nível | Campos |
|---|---|---|
| resolução de branding (miss de cache) | debug | host, workspaceId, hash, fonte da cadeia (domain/workspace/distribution) |
| fallback acionado (config/asset/adapter) | **warn** | motivo, alvo, hash esperado |
| publicação/rollback (sucesso/falha) | info/error | versionId, ator, duração, estágio da falha |
| validação falhou | info | validationRunId, códigos de erro (sem valores de cliente sensíveis) |
| asset rejeitado | info | motivo, formato, tamanho (nunca o conteúdo) |
| adapter incompatível | **error** | adapterVersion, twentyVersion, issues bloqueantes |
| falha pós-sync upstream (bridge) | error no CI | syncRunId, etapa |

### Métricas

| Métrica | Tipo | Uso |
|---|---|---|
| `o2d_branding_resolve_total{source,cache}` | counter | mix de cadeia + hit-rate de cache |
| `o2d_branding_resolve_duration_ms` | histogram | latência do `GET /branding/current` |
| `o2d_branding_artifact_bytes{mode}` | gauge | tamanho dos artefatos publicados |
| `o2d_branding_asset_fallback_total{slot}` | counter | saúde de assets em produção |
| `o2d_branding_publish_total{result}` / `rollback_total` | counter | operações + erros de publicação/rollback |
| `o2d_branding_validation_fail_total{code}` | counter | regras que mais reprovam (feedback de UX) |
| `o2d_branding_flash_reports_total` | counter | telemetria de flash no cliente (ver abaixo) |
| `o2d_branding_adapter_incompat_total` | counter | alarme imediato |

**Detecção de flash de tema**: o provider mede (Performance API) o intervalo entre primeiro paint e aplicação do artefato completo e reporta quando > limiar (proposta: 100ms com mudança visual de tokens críticos) — beacon amostrado, sem PII.

### Tracing e correlação

- `correlationId` em toda mutação e propagado a jobs/eventos (doc 20); spans nas etapas de publicação (validar → gerar → persistir → invalidar).
- Falhas de carregamento no cliente (artefato, assets, cache local corrompido) reportadas com hash + status — permite diagnosticar "instância X está servindo fallback" sem acesso ao cliente.

### Alertas mínimos

`adapter_incompat > 0`; `asset_fallback_total` acelerando; taxa de fallback do endpoint público > 1%; falha de publicação; latência p95 do resolve > 150ms.

## 2. Desempenho

### Orçamentos (metas / critérios de aceite)

| Item | Meta |
|---|---|
| Artefato CSS por modo | ≤ 15 KB bruto, ≤ 4 KB gzip (é um bloco de variáveis; os ~2×1000 tokens do Twenty somam ordem de 30–40 KB — o artefato só carrega **overrides**, tipicamente dezenas de linhas) |
| Bloco inline crítico no HTML | ≤ 2 KB (apenas tokens críticos + título/favicon) |
| `GET /branding/current` | p95 ≤ 50ms com cache Redis; ≥ 95% hit-rate combinado (Redis+ETag) |
| Impacto no First Contentful Paint | ≤ 5ms adicionais (inline já presente no HTML; sem request bloqueante no caminho crítico com cache local) |
| Flash de tema | 0 perceptível (cenário 18, doc 23; telemetria §1) |
| Aplicação de nova publicação no cliente | troca atômica de stylesheet, sem reflow em cascata (1 nó `<style>` substituído) |
| Assets | imutáveis por hash ⇒ `immutable` cache; favicon/logos ≤ 100 KB; imagens de login com variantes responsivas |

### Técnicas

- **Injeção de CSS variables**: um único elemento `<style id="o2d-branding">`; substituição por swap de nó (não edição incremental) — evita estados intermediários.
- **Hidratação/SSR**: o front é SPA Vite (sem SSR — `index.html` + `root`, evidência doc 00 §2); a estratégia anti-flash não depende de SSR. Se o upstream adotar SSR futuramente, o bridge reavalia (o artefato por hash é compatível com render server-side).
- **Lazy loading**: admin UI e preview são chunks separados (código de edição nunca entra no bundle do usuário comum); sanitizador/validador completo só no server e na admin.
- **Cache/CDN/invalidations**: doc 07 §5 e doc 11 §4 (conteúdo endereçado por hash → CDN sem purge).
- **Múltiplos workspaces/domínios**: resolução O(1) por chave de cache; artefatos compartilham assets por hash (dedupe natural); cold start de instância pré-aquece o artefato da distribuição.

### Testes de desempenho

Teste de carga do endpoint público (mix hit/miss); medição de FCP com e sem engine no cenário e2e (budget assertion); verificação de tamanho de artefato como teste de CI (falha se orçamento estourar).
