export type TokenType =
  | 'color'
  | 'dimension'
  | 'shadow'
  | 'fontFamily'
  | 'fontWeight'
  | 'number'
  | 'duration';

// Tiers per doc 09 §2.3 — they drive which tokens a config may set and
// which ones the core computes itself.
export type TokenTier =
  | 'required'
  | 'optional'
  | 'derived'
  | 'calculated'
  | 'restricted'
  | 'readonly';

export type TokenMode = 'light' | 'dark';

export type TokenValue = string | number;

export type ModedTokenValue = { light: TokenValue; dark: TokenValue };

export type TokenCatalogEntry = {
  type: TokenType;
  tier: TokenTier;
  // perMode tokens hold independent light/dark values; shared tokens hold one
  // value replicated across both modes (font sizes, radii, families...).
  modes: 'perMode' | 'shared';
  // Dimension bounds in the unit the token is expressed in (doc 06 §4).
  min?: string;
  max?: string;
};

export type O2DAssetSlot =
  | 'favicon'
  | 'logoLight'
  | 'logoDark'
  | 'loginBackground'
  | 'emailLogo'
  | 'documentLogo';

// Assets travel by ID + content hash only — URL resolution is server-side (doc 11).
export type AssetRef = { assetId: string; hash: string };

export type O2DBrandingTokensInput = Record<
  string,
  TokenValue | ModedTokenValue
>;

// Sparse configuration exactly as a client edits it (doc 06 §2).
export type O2DBrandingConfig = {
  schemaVersion: 'o2d.branding.config/1-0-0';
  basePreset: string;
  brand: {
    productName: string;
    shortName: string;
    description?: string;
  };
  tokens: O2DBrandingTokensInput;
  assets: Partial<Record<O2DAssetSlot, AssetRef>>;
};

export type ResolvedTokenMap = Record<string, TokenValue>;

export type ResolvedAssetMap = Partial<Record<O2DAssetSlot, AssetRef>>;

export type O2DResolvedBranding = {
  tokens: { light: ResolvedTokenMap; dark: ResolvedTokenMap };
  assets: ResolvedAssetMap;
  meta: {
    hash: string;
    schemaVersion: string;
    basePreset: string;
    generatedAt?: string;
  };
};

// A preset is a dense, valid token set owned by the distribution (doc 06 §5).
export type O2DBrandingPreset = {
  name: string;
  version: number;
  // Upstream base commit the values were extracted from (doc 21).
  sourceCommit: string;
  brand: { productName: string; shortName: string };
  tokens: Record<string, ModedTokenValue>;
  assets: ResolvedAssetMap;
};

export type CssVariableBlock = Record<string, string>;

export type ThemeOverrides = { light: CssVariableBlock; dark: CssVariableBlock };

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssue = {
  rule: string;
  severity: ValidationSeverity;
  message: string;
  tokenPath?: string;
  mode?: TokenMode;
  measured?: string;
  required?: string;
};

export type ValidationResult = {
  status: 'valid' | 'failed';
  issues: ValidationIssue[];
};

export type CompatibilityIssueKind =
  | 'missing'
  | 'renamed'
  | 'hardcoded'
  | 'removedComponent';

export type CompatibilityIssue = {
  tokenPath: string;
  kind: CompatibilityIssueKind;
  severity: 'blocking' | 'warning';
  suggestedAction: string;
};

export type CompatibilityResult = {
  status: 'compatible' | 'degraded' | 'incompatible';
  issues: CompatibilityIssue[];
};

export type TwentyAssets = Partial<Record<O2DAssetSlot, string>>;

export type GlobalPointMap = {
  titleFallback: { file: string; expected: string };
  faviconLink: { file: string; expected: string };
  manifestUrl: { file: string; expected: string };
};

export type ComponentTokenMap = Record<string, string>;

// Contract every version adapter implements (doc 10 §3). Adapters are the only
// layer allowed to know concrete --t-* names.
export type TwentyBrandingAdapter = {
  version: string;
  supportedRange: { baseCommit: string; appVersionRange?: string };
  mapThemeTokens(resolved: O2DResolvedBranding['tokens']): ThemeOverrides;
  mapAssets(assets: ResolvedAssetMap): TwentyAssets;
  mapGlobalPoints(): GlobalPointMap;
  mapComponents(): ComponentTokenMap;
  // The adapter stays pure: callers parse the installed CSS and hand the
  // available variable names in (tests/bridge own the IO).
  validateCompatibility(availableCssVariables: {
    light: ReadonlySet<string>;
    dark: ReadonlySet<string>;
  }): CompatibilityResult;
};
