# 06 — `o2d-branding-core` (contratos, schemas, validação)

> **Status:** proposta — nada implementado. Pacote TypeScript puro (sem React/Nest/IO), consumido por server, front, adapters e CLI do bridge.

## 1. Responsabilidades

Contratos; schemas; tokens; tipos; presets; defaults; validações; regras de compatibilidade; normalização; geração de overrides. **Não** faz IO, não conhece banco, não conhece HTTP.

## 2. Contratos principais (assinaturas conceituais — não implementar nesta etapa)

```typescript
// Configuração como o cliente edita (esparsa)
type O2DBrandingConfig = {
  schemaVersion: string;            // 'o2d.branding.config/1-0-0'
  basePreset: string;               // 'preset.odois' | 'preset.twenty-default' | ...
  brand: { productName; shortName; description?; };
  tokens: Partial<O2DBrandingTokens>;      // apenas o que difere do preset
  assets: Record<O2DAssetSlot, AssetRef>;  // refs por ID, nunca URL crua
  login?: LoginCustomization;              // nível 2
  emails?: EmailCustomization;             // fase 7
};

// Configuração normalizada (densa, determinística)
type O2DResolvedBranding = {
  tokens: { light: ResolvedTokenMap; dark: ResolvedTokenMap };
  assets: ResolvedAssetMap;
  meta: { hash; schemaVersion; basePreset; generatedAt };
};

// Saída por adapter (doc 10)
type ThemeOverrides = { light: CssVariableBlock; dark: CssVariableBlock };
```

`AssetRef = { assetId: string; hash: string }` — a resolução para URL acontece no server (doc 11).

## 3. Pipeline de normalização

```text
config esparsa
  → merge com preset base (deep, determinístico)
  → merge com defaults da distribuição
  → derivação (hover/active, escala 1-12, onPrimary sugerido)   [doc 09 §2.3-2.4]
  → congelamento + hash canônico (JSON ordenado, SHA-256)
```

Propriedades exigidas: **pura e determinística** (mesmo input ⇒ mesmo hash — o hash entra no snapshot de versão e no cache), **total** (nunca lança para input válido pelo schema; erros viram resultado tipado), **estável entre versões do core** (mudança de comportamento de derivação ⇒ bump de `schemaVersion` + migração documentada).

## 4. Validações (Etapa 14 da missão)

Executadas em três momentos: ao salvar rascunho (rápidas), no comando "Validar" (completas) e obrigatoriamente antes de publicar (completas + compatibilidade do adapter).

| Grupo | Regras | Severidade |
|---|---|---|
| JSON Schema | estrutura, tipos, `schemaVersion` conhecido, campos desconhecidos rejeitados | erro |
| Tokens obrigatórios | presença dos tokens tier "obrigatório" (doc 09 §2.3) pós-normalização | erro |
| Cores | formato hex/rgb/oklch válido; canal alfa proibido onde o alvo exige opaco | erro |
| Contraste | invariantes A1–A7 do doc 16, nos dois modos | erro (AA) / aviso (AAA) |
| Dimensões | raios, sombras, espaçamentos dentro de min/max por token (declarados no catálogo) | erro |
| CSS gerado | valores não podem conter `;`, `}`, `url(`, `expression`, `@import` (anti-injeção — doc 17); apenas literais tipados | erro |
| URLs | nenhum campo aceita URL externa; assets só por `assetId` | erro |
| Assets | slots obrigatórios preenchidos ou com fallback; hash existente (checagem de integridade delegada ao server) | erro/aviso |
| Fontes | família ∈ catálogo curado; fallback stack obrigatória | erro |
| Compatibilidade | `CompatibilityResult` do adapter instalado sem itens `blocking` | erro |
| Versão Twenty | `twentyVersion` do artefato == versão da instância (`APP_VERSION` + commit base) | erro |
| Acessibilidade adicional | tamanho mínimo de fonte, distinção de status | erro (doc 16) |
| Integridade | hash do snapshot confere com conteúdo | erro |

**Comportamentos definidos:**

| Situação | Comportamento |
|---|---|
| Configuração inválida | estado `VALIDATION_FAILED`; publicada anterior permanece ativa; erros listados por token com valores medidos |
| Asset indisponível em runtime | fallback em cadeia (asset da distribuição → default seguro, doc 11 §fallback); métrica + log (doc 25); nunca quebra layout |
| Adapter incompatível | publicação bloqueada (`branding.adapter.incompatible`); runtime continua com o último artefato compatível |
| Tema quebrado detectado em runtime (artefato corrompido/hash divergente) | provider descarta o artefato, aplica fallback da distribuição, reporta |
| Token ausente no artefato | valor do preset da distribuição; se também ausente, default do Twenty (o CSS base nunca é removido — degradação natural da cascata) |
| Valor fora dos limites | rejeitado na validação; nunca "clampado" silenciosamente |
| Versão do Twenty não suportada por adapter | boot da distribuição falha o build (Nível 3); em runtime, engine desativa overrides e mantém tema padrão + alerta |

## 5. Presets e defaults

- Preset = `O2DBrandingConfig` completo e válido, identificado e versionado (`preset.odois@1`).
- `preset.twenty-default` é **gerado pelo upstream bridge** extraindo os valores reais de `theme-light.css`/`theme-dark.css` da versão instalada — nunca mantido à mão (doc 21).
- Defaults da distribuição preenchem: nome do produto, assets de fallback, catálogo de fontes.

## 6. Regras de compatibilidade (contrato com adapters)

O core define os tipos que os adapters implementam (doc 10): `TwentyBrandingAdapter`, `CompatibilityResult { status: compatible | degraded | incompatible; issues: CompatibilityIssue[] }`, `CompatibilityIssue { tokenPath; kind: missing | renamed | hardcoded | removedComponent; severity: blocking | warning; suggestedAction }`. O core decide o efeito (bloquear publicação, degradar com aviso) — o adapter apenas reporta.

## 7. Testes do core (ver doc 23 §unitários)

Golden tests de normalização (input → hash estável); propriedade de determinismo; tabela de contraste com valores-limite; snapshots do CSS gerado por preset; fuzz leve no parser de cores; testes de rejeição para cada regra de validação.
