import gql from 'graphql-tag';

const CONFIGURATION_FIELDS = gql`
  fragment O2dBrandingConfigurationFields on O2dBrandingConfiguration {
    id
    name
    status
    publishedVersionId
    draftConfig
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
      changelog
      createdAt
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

export const VALIDATE_O2D_BRANDING_DRAFT = gql`
  mutation ValidateO2dBrandingDraft($id: UUID!) {
    validateO2dBrandingDraft(id: $id) {
      status
      issues
    }
  }
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
