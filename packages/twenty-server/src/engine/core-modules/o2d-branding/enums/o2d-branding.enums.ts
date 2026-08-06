// Status machines from docs/specs/branding-engine (docs 15/18).
export enum O2dBrandingConfigurationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum O2dBrandingVersionStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  READY_TO_PUBLISH = 'READY_TO_PUBLISH',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
  ROLLED_BACK = 'ROLLED_BACK',
  ARCHIVED = 'ARCHIVED',
}

export enum O2dBrandingAssetStatus {
  PROCESSING = 'PROCESSING',
  VALID = 'VALID',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum O2dBrandingDomainStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  DISABLED = 'DISABLED',
}

export enum O2dBrandingPublicationEnvironment {
  PRODUCTION = 'PRODUCTION',
  PREVIEW = 'PREVIEW',
}

export enum O2dBrandingPublicationStatus {
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum O2dBrandingCompatibilityStatus {
  COMPATIBLE = 'COMPATIBLE',
  DEGRADED = 'DEGRADED',
  INCOMPATIBLE = 'INCOMPATIBLE',
}
