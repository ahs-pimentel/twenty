import { type TokenCatalogEntry, type TokenTier } from '../types/branding.types';

// Abstract token catalog v1 (doc 09 §2.2/§2.3) — FROZEN.
// Renaming or removing an entry is a schemaVersion bump with a documented
// migration; the catalog freeze test guards this.
export const TOKEN_CATALOG_VERSION = 'o2d.branding.tokens/1-0-0';

const color = (tier: TokenTier): TokenCatalogEntry => ({
  type: 'color',
  tier,
  modes: 'perMode',
});

const sharedDimension = (
  tier: TokenTier,
  min?: string,
  max?: string,
): TokenCatalogEntry => ({ type: 'dimension', tier, modes: 'shared', min, max });

export const TOKEN_CATALOG: Record<string, TokenCatalogEntry> = {
  // Brand
  'brand.primary': color('required'),
  'brand.primaryHover': color('derived'),
  'brand.primaryActive': color('derived'),
  'brand.onPrimary': color('required'),
  'brand.scale.1': color('calculated'),
  'brand.scale.2': color('calculated'),
  'brand.scale.3': color('calculated'),
  'brand.scale.4': color('calculated'),
  'brand.scale.5': color('calculated'),
  'brand.scale.6': color('calculated'),
  'brand.scale.7': color('calculated'),
  'brand.scale.8': color('calculated'),
  'brand.scale.9': color('calculated'),
  'brand.scale.10': color('calculated'),
  'brand.scale.11': color('calculated'),
  'brand.scale.12': color('calculated'),

  // Backgrounds and surfaces
  'background.primary': color('required'),
  'background.secondary': color('optional'),
  'background.tertiary': color('optional'),
  'surface.primary': color('required'),
  'surface.secondary': color('optional'),
  'surface.elevated': color('derived'),

  // Text
  'text.primary': color('required'),
  'text.secondary': color('required'),
  'text.muted': color('optional'),
  'text.inverse': color('optional'),

  // Borders
  'border.default': color('optional'),
  'border.strong': color('optional'),
  'border.focus': color('derived'),

  // Status
  'status.success': color('optional'),
  'status.warning': color('optional'),
  'status.error': color('optional'),
  'status.info': color('optional'),

  // Typography
  'font.family.body': { type: 'fontFamily', tier: 'restricted', modes: 'shared' },
  'font.family.heading': {
    type: 'fontFamily',
    tier: 'restricted',
    modes: 'shared',
  },
  // A4 floor: no step may go below 0.75rem (doc 16).
  'font.size.xs': sharedDimension('optional', '0.75rem', '1.5rem'),
  'font.size.sm': sharedDimension('optional', '0.75rem', '1.75rem'),
  'font.size.md': sharedDimension('optional', '0.75rem', '2rem'),
  'font.size.lg': sharedDimension('optional', '0.9rem', '2.5rem'),
  'font.size.xl': sharedDimension('optional', '1rem', '3rem'),
  'font.weight.regular': { type: 'fontWeight', tier: 'optional', modes: 'shared' },
  'font.weight.medium': { type: 'fontWeight', tier: 'optional', modes: 'shared' },
  'font.weight.semibold': {
    type: 'fontWeight',
    tier: 'optional',
    modes: 'shared',
  },
  'font.weight.bold': { type: 'fontWeight', tier: 'optional', modes: 'shared' },
  'font.lineHeight': { type: 'number', tier: 'optional', modes: 'shared' },

  // Spacing / density — read-only in the MVP (doc 09 §2.3, OQ-09-2).
  'spacing.unit': { type: 'number', tier: 'readonly', modes: 'shared' },
  'layout.density': { type: 'number', tier: 'restricted', modes: 'shared' },

  // Radii
  'radius.sm': sharedDimension('optional', '0px', '12px'),
  'radius.md': sharedDimension('optional', '0px', '24px'),
  'radius.lg': sharedDimension('optional', '0px', '32px'),
  'radius.xl': sharedDimension('optional', '0px', '48px'),
  'radius.pill': sharedDimension('optional', '0px', '999px'),

  // Shadows
  'shadow.sm': { type: 'shadow', tier: 'optional', modes: 'perMode' },
  'shadow.md': { type: 'shadow', tier: 'optional', modes: 'perMode' },
  'shadow.lg': { type: 'shadow', tier: 'optional', modes: 'perMode' },
  'shadow.overlay': { type: 'shadow', tier: 'optional', modes: 'perMode' },

  // Layout — global points in the current adapter, no CSS var target yet.
  'layout.sidebar.width': sharedDimension('restricted', '180px', '480px'),
  'layout.sidebar.collapsedWidth': sharedDimension('restricted', '40px', '120px'),
  'layout.header.height': sharedDimension('restricted', '32px', '96px'),
  'layout.content.maxWidth': sharedDimension('restricted', '640px', '2560px'),
};

export const CATALOG_TOKEN_PATHS = Object.keys(TOKEN_CATALOG);

export const REQUIRED_TOKEN_PATHS = CATALOG_TOKEN_PATHS.filter(
  (path) => TOKEN_CATALOG[path].tier === 'required',
);

// Semantic component aliases (doc 09 §2.2) — resolve to base tokens, never to
// free CSS. They emit no CSS variables in adapter v1.
export const COMPONENT_TOKEN_ALIASES: Record<string, string> = {
  'button.primary.background': 'brand.primary',
  'button.primary.foreground': 'brand.onPrimary',
  'button.primary.radius': 'radius.sm',
  'card.background': 'surface.primary',
  'card.border': 'border.default',
  'card.radius': 'radius.md',
  'input.background': 'background.primary',
  'input.border': 'border.default',
  'input.focus': 'border.focus',
  'table.headerBackground': 'surface.primary',
  'table.rowHover': 'surface.secondary',
  'sidebar.background': 'surface.primary',
  'sidebar.foreground': 'text.secondary',
  'sidebar.itemActiveBackground': 'surface.secondary',
  'sidebar.itemActiveForeground': 'text.primary',
};

export const isCatalogTokenPath = (path: string): boolean =>
  Object.prototype.hasOwnProperty.call(TOKEN_CATALOG, path);
