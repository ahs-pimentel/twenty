// Hand-written types for the o2d-branding admin GraphQL surface — this
// module sits outside the codegen document globs, following the legal/DPA
// precedent (see codegen-metadata.cjs notes).
export type O2dBrandingAdminConfiguration = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  publishedVersionId: string | null;
  draftConfig: O2dBrandingAdminDraftConfig | null;
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
  changelog: string | null;
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
