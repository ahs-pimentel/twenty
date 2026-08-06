// Shared constants for the twenty-538b1808 adapter and the preset
// extraction script. This module is the only place that knows --t-* names
// (doc 10 §1).

// Abstract token → CSS custom properties it writes (same names in both
// modes). A token may fan out to several variables; no variable has more
// than one writer.
export const TOKEN_CSS_TARGETS: Record<string, string[]> = {
  'background.primary': ['--t-background-primary'],
  'background.secondary': ['--t-background-secondary'],
  'background.tertiary': ['--t-background-tertiary'],
  'text.primary': ['--t-font-color-primary'],
  'text.secondary': ['--t-font-color-secondary'],
  'text.muted': ['--t-font-color-tertiary'],
  'text.inverse': ['--t-font-color-inverted'],
  'border.default': ['--t-border-color-medium'],
  'border.strong': ['--t-border-color-strong'],
  'border.focus': ['--t-border-color-blue'],
  'status.success': ['--t-color-green'],
  'status.warning': ['--t-color-orange'],
  'status.error': ['--t-color-red', '--t-font-color-danger'],
  'font.family.body': ['--t-font-family'],
  'font.size.xs': ['--t-font-size-xs'],
  'font.size.sm': ['--t-font-size-sm'],
  'font.size.md': ['--t-font-size-md'],
  'font.size.lg': ['--t-font-size-lg'],
  'font.size.xl': ['--t-font-size-xl'],
  'font.weight.regular': ['--t-font-weight-regular'],
  'font.weight.medium': ['--t-font-weight-medium'],
  'font.weight.semibold': ['--t-font-weight-semi-bold'],
  'font.lineHeight': ['--t-text-line-height-lg'],
  'radius.sm': ['--t-border-radius-sm'],
  'radius.md': ['--t-border-radius-md'],
  'radius.xl': ['--t-border-radius-xl'],
  'radius.pill': ['--t-border-radius-pill'],
  'shadow.sm': ['--t-box-shadow-light'],
  'shadow.md': ['--t-box-shadow-strong'],
  'shadow.lg': ['--t-box-shadow-super-heavy'],
  'spacing.unit': ['--t-spacing-multiplicator'],
  'brand.primary': ['--t-color-blue'],
};

// Brand scale steps → accent + named-color scales (Radix indigo family).
export const SCALE_CSS_TARGETS = (step: number): string[] => [
  `--t-accent-accent${step}`,
  `--t-color-blue${step}`,
];

// Accent aliases derived from scale steps — identical structure in both
// modes (verified against theme-light.css / theme-dark.css).
export const ACCENT_ALIAS_STEPS: Record<string, number> = {
  '--t-accent-primary': 5,
  '--t-accent-secondary': 5,
  '--t-accent-tertiary': 3,
  '--t-accent-quaternary': 2,
  '--t-accent-accent3570': 8,
  '--t-accent-accent4060': 8,
};

// Tokens that exist in the abstract model but intentionally emit no CSS in
// this adapter: they feed validation, derivation or component aliases only.
export const SEMANTIC_ONLY_TOKENS = new Set([
  'brand.onPrimary',
  'brand.primaryHover',
  'brand.primaryActive',
  'surface.primary',
  'surface.secondary',
  'surface.elevated',
  'status.info',
]);

// Catalog tokens the 538b1808 base offers no target for — reported as
// non-blocking compatibility issues (doc 10 §5).
export const UNMAPPED_TOKENS = new Set([
  'font.family.heading',
  'font.weight.bold',
  'radius.lg',
  'shadow.overlay',
  'layout.density',
  'layout.sidebar.width',
  'layout.sidebar.collapsedWidth',
  'layout.header.height',
  'layout.content.maxWidth',
]);

export const UPSTREAM_BASE_COMMIT = '538b180824dc4c3bbd3b9cb70662a01a69a64ae1';
