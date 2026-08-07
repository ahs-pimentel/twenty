// Hand-written types for the o2d-branding admin GraphQL surface — this
// module sits outside the codegen document globs, following the legal/DPA
// precedent (see codegen-metadata.cjs notes).
export type O2dBrandingAdminConfiguration = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  publishedVersionId: string | null;
  draftConfig: O2dBrandingAdminDraftConfig | null;
  draftHash: string | null;
  draftUpdatedAt: string | null;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type O2dBrandingAdminDraftConfig = {
  schemaVersion: string;
  basePreset: string;
  brand: { productName: string; shortName: string; description?: string };
  tokens: Record<
    string,
    string | number | { light: string | number; dark: string | number }
  >;
  assets: Record<string, { assetId: string; hash: string }>;
};

export type O2dBrandingAdminVersion = {
  id: string;
  number: number;
  status:
    | 'DRAFT'
    | 'VALIDATING'
    | 'VALIDATION_FAILED'
    | 'READY_TO_PUBLISH'
    | 'PUBLISHED'
    | 'SUPERSEDED'
    | 'ROLLED_BACK'
    | 'ARCHIVED';
  hash: string;
  adapterVersion: string;
  basedOnVersionId: string | null;
  changelog: string | null;
  createdAt: string;
  artifact: {
    cssLight: Record<string, string>;
    cssDark: Record<string, string>;
    meta: { adapterVersion: string; hash: string };
  } | null;
};

export type O2dBrandingAdminAsset = {
  id: string;
  type: string;
  name: string;
  format: string;
  sizeBytes: number;
  hash: string;
  url: string | null;
  status: 'PROCESSING' | 'VALID' | 'REJECTED' | 'ARCHIVED';
  createdAt: string;
};

export type O2dBrandingAdminDomain = {
  id: string;
  hostname: string;
  configurationId: string | null;
  isVerified: boolean;
  isPrimary: boolean;
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  createdAt: string;
};

export type O2dBrandingAdminValidationIssue = {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  tokenPath?: string;
  mode?: 'light' | 'dark';
  measured?: string;
  required?: string;
};

export type O2dBrandingAdminValidationResult = {
  status: 'valid' | 'failed';
  issues: O2dBrandingAdminValidationIssue[];
};

export type O2dBrandingAdminValidationRun = {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  draftHash: string;
  result: O2dBrandingAdminValidationResult | null;
  startedAt: string;
  finishedAt: string | null;
};

export type O2dBrandingAdminDraftPreview = {
  status: 'valid' | 'failed';
  issues: O2dBrandingAdminValidationIssue[];
  artifact: {
    hash: string;
    cssLight: Record<string, string>;
    cssDark: Record<string, string>;
    brand: { productName: string; shortName: string };
    assets: Record<string, { url: string; hash: string; format: string }>;
  } | null;
};

export type O2dBrandingAdminTokenChange = {
  tokenPath: string;
  mode: 'light' | 'dark';
  kind: 'added' | 'removed' | 'changed';
  from: string | number | null;
  to: string | number | null;
};

export type O2dBrandingAdminAssetChange = {
  slot: string;
  kind: 'added' | 'removed' | 'changed';
  fromHash: string | null;
  toHash: string | null;
};

export type O2dBrandingAdminVersionDiff = {
  fromNumber: number;
  toNumber: number;
  tokenChanges: O2dBrandingAdminTokenChange[];
  assetChanges: O2dBrandingAdminAssetChange[];
};

// Client-side projection of the doc 15 draft state machine: the draft hash
// plus the latest validation run fully determine the state, and any edit
// changes the hash — demoting back to DRAFT without server bookkeeping.
export type O2dBrandingDraftStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'VALIDATION_FAILED'
  | 'READY_TO_PUBLISH';
