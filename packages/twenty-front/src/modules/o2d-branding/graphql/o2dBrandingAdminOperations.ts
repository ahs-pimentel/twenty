import gql from 'graphql-tag';

const CONFIGURATION_FIELDS = gql`
  fragment O2dBrandingConfigurationFields on O2dBrandingConfiguration {
    id
    name
    status
    publishedVersionId
    draftConfig
    draftHash
    draftUpdatedAt
    schemaVersion
    createdAt
    updatedAt
  }
`;

export const GET_O2D_BRANDING_CONFIGURATIONS = gql`
  query GetO2dBrandingConfigurations {
    o2dBrandingConfigurations {
      ...O2dBrandingConfigurationFields
    }
  }
  ${CONFIGURATION_FIELDS}
`;

export const GET_O2D_BRANDING_VERSIONS = gql`
  query GetO2dBrandingVersions($configurationId: UUID!) {
    o2dBrandingVersions(configurationId: $configurationId) {
      id
      number
      status
      hash
      adapterVersion
      basedOnVersionId
      changelog
      createdAt
      artifact
    }
  }
`;

export const CREATE_O2D_BRANDING_CONFIGURATION = gql`
  mutation CreateO2dBrandingConfiguration(
    $name: String!
    $basePreset: String!
  ) {
    createO2dBrandingConfiguration(name: $name, basePreset: $basePreset) {
      ...O2dBrandingConfigurationFields
    }
  }
  ${CONFIGURATION_FIELDS}
`;

export const UPDATE_O2D_BRANDING_DRAFT = gql`
  mutation UpdateO2dBrandingDraft(
    $id: UUID!
    $draftConfig: JSON!
    $expectedDraftUpdatedAt: DateTime
  ) {
    updateO2dBrandingDraft(
      id: $id
      draftConfig: $draftConfig
      expectedDraftUpdatedAt: $expectedDraftUpdatedAt
    ) {
      ...O2dBrandingConfigurationFields
    }
  }
  ${CONFIGURATION_FIELDS}
`;

export const PUBLISH_O2D_BRANDING_CONFIGURATION = gql`
  mutation PublishO2dBrandingConfiguration($id: UUID!, $changelog: String) {
    publishO2dBrandingConfiguration(id: $id, changelog: $changelog) {
      id
      number
      status
      hash
    }
  }
`;

export const GET_O2D_BRANDING_ASSETS = gql`
  query GetO2dBrandingAssets($configurationId: UUID!) {
    o2dBrandingAssets(configurationId: $configurationId) {
      id
      type
      name
      format
      sizeBytes
      hash
      url
      status
      createdAt
    }
  }
`;

export const UPLOAD_O2D_BRANDING_ASSET = gql`
  mutation UploadO2dBrandingAsset(
    $configurationId: UUID!
    $slot: String!
    $file: Upload!
  ) {
    uploadO2dBrandingAsset(
      configurationId: $configurationId
      slot: $slot
      file: $file
    ) {
      id
      type
      name
      format
      sizeBytes
      hash
      url
      status
      createdAt
    }
  }
`;

export const PREVIEW_O2D_BRANDING_DRAFT = gql`
  query PreviewO2dBrandingDraft($configurationId: UUID!) {
    previewO2dBrandingDraft(configurationId: $configurationId) {
      status
      issues
      artifact
    }
  }
`;

export const START_O2D_BRANDING_DRAFT_VALIDATION = gql`
  mutation StartO2dBrandingDraftValidation($id: UUID!) {
    startO2dBrandingDraftValidation(id: $id) {
      id
      status
      draftHash
      result
      startedAt
      finishedAt
    }
  }
`;

export const GET_O2D_BRANDING_VALIDATION_RUN = gql`
  query GetO2dBrandingValidationRun($configurationId: UUID!) {
    o2dBrandingValidationRun(configurationId: $configurationId) {
      id
      status
      draftHash
      result
      startedAt
      finishedAt
    }
  }
`;

export const GET_O2D_BRANDING_VERSION_DIFF = gql`
  query GetO2dBrandingVersionDiff(
    $configurationId: UUID!
    $fromNumber: Int!
    $toNumber: Int!
  ) {
    o2dBrandingVersionDiff(
      configurationId: $configurationId
      fromNumber: $fromNumber
      toNumber: $toNumber
    ) {
      fromNumber
      toNumber
      tokenChanges
      assetChanges
    }
  }
`;

export const RESTORE_O2D_BRANDING_VERSION_AS_DRAFT = gql`
  mutation RestoreO2dBrandingVersionAsDraft($id: UUID!, $versionNumber: Int!) {
    restoreO2dBrandingVersionAsDraft(id: $id, versionNumber: $versionNumber) {
      ...O2dBrandingConfigurationFields
    }
  }
  ${CONFIGURATION_FIELDS}
`;

export const ROLLBACK_O2D_BRANDING_CONFIGURATION = gql`
  mutation RollbackO2dBrandingConfiguration(
    $id: UUID!
    $toVersion: Int!
    $reason: String!
  ) {
    rollbackO2dBrandingConfiguration(
      id: $id
      toVersion: $toVersion
      reason: $reason
    ) {
      id
      number
      status
      hash
    }
  }
`;
