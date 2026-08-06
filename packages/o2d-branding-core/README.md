# o2d-branding-core

Core of the óDois Branding Engine (spec: `docs/specs/branding-engine/`).
Pure TypeScript — no React, no Nest, no IO. Consumed by the branding server,
front provider, upstream-bridge CLI and (for now) hosting the version
adapters until a second consumer justifies the `o2d-branding-adapters`
split (doc 10).

## What lives here (phase 1)

| Area | Entry | Spec |
|---|---|---|
| Abstract token catalog v1 (frozen) | `src/tokens/tokenCatalog.ts` | doc 09 |
| Config schema `o2d.branding.config/1-0-0` | `src/schemas/` + `schemas/*.schema.json` | doc 06 |
| Color math (P3/sRGB, OKLCH, contrast) | `src/color/colorUtils.ts` | doc 16 |
| Brand scale generation (1–12) | `src/color/generateBrandScale.ts` | doc 09 §2.4 |
| Normalization + canonical SHA-256 hash | `src/normalize/` | doc 06 §3 |
| Validation incl. A1–A7 invariants | `src/validate/` | docs 06 §4, 16 |
| `preset.twenty-default` (generated) | `src/presets/` | doc 06 §5 |
| Adapter `twenty-538b1808` | `src/adapters/` | doc 10 |

## Invariants enforced by tests

- **Neutral round-trip**: `preset.twenty-default` through the current adapter
  emits only values byte-identical to the installed
  `twenty-ui/src/theme-constants/theme-{light,dark}.css` — zero visual diff
  by construction (phase 1 acceptance, doc 26).
- **Deterministic hash**: same config ⇒ same canonical SHA-256; golden
  snapshots guard normalization behavior.
- **Generated artifacts stay in sync**: the committed preset JSON and JSON
  Schema are regenerated in tests and compared (`scripts/generateTwentyDefaultPreset.ts`,
  `scripts/generateJsonSchema.ts`).

## Commands

```bash
npx nx test o2d-branding-core        # jest suite
npx nx typecheck o2d-branding-core
npx nx build o2d-branding-core       # dist (CJS + d.ts) consumed by twenty-server
npx tsx scripts/generateTwentyDefaultPreset.ts   # after an upstream sync
npx tsx scripts/generateOdoisPreset.ts           # after brand config changes
npx tsx scripts/generateDistributionArtifact.ts  # regenerates front artifact + index.html block
npx tsx scripts/generateJsonSchema.ts            # after schema changes
```

## Licensing note

Declared AGPL-3.0 like the rest of the fork while JUR-1 (AGPL × proprietary
boundary, doc 24/27) is open. óDois identity assets are **not** committed
here — presets carrying proprietary assets are delivered as data (doc 24).
