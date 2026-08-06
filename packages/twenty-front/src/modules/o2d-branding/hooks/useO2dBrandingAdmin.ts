import { useMutation, useQuery } from '@apollo/client/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  CREATE_O2D_BRANDING_CONFIGURATION,
  GET_O2D_BRANDING_CONFIGURATIONS,
  GET_O2D_BRANDING_VERSIONS,
  PUBLISH_O2D_BRANDING_CONFIGURATION,
  ROLLBACK_O2D_BRANDING_CONFIGURATION,
  UPDATE_O2D_BRANDING_DRAFT,
  VALIDATE_O2D_BRANDING_DRAFT,
} from '@/o2d-branding/graphql/o2dBrandingAdminOperations';
import {
  type O2dBrandingAdminConfiguration,
  type O2dBrandingAdminValidationResult,
  type O2dBrandingAdminVersion,
} from '@/o2d-branding/types/O2dBrandingAdmin';

// Admin data access for the branding settings page. The o2d-branding
// resolvers live in the core schema, so every operation pins the core
// Apollo client (same pattern as settings/legal).
export const useO2dBrandingAdmin = () => {
  const apolloCoreClient = useApolloCoreClient();

  const {
    data: configurationsData,
    loading: configurationsLoading,
    refetch: refetchConfigurations,
  } = useQuery<{
    o2dBrandingConfigurations: O2dBrandingAdminConfiguration[];
  }>(GET_O2D_BRANDING_CONFIGURATIONS, { client: apolloCoreClient });

  const configuration = configurationsData?.o2dBrandingConfigurations[0];

  const { data: versionsData, refetch: refetchVersions } = useQuery<{
    o2dBrandingVersions: O2dBrandingAdminVersion[];
  }>(GET_O2D_BRANDING_VERSIONS, {
    client: apolloCoreClient,
    variables: { configurationId: configuration?.id },
    skip: configuration === undefined,
  });

  const refetchAll = async () => {
    await refetchConfigurations();

    if (configuration !== undefined) {
      await refetchVersions();
    }
  };

  const [createConfiguration, { loading: isCreating }] = useMutation<{
    createO2dBrandingConfiguration: O2dBrandingAdminConfiguration;
  }>(CREATE_O2D_BRANDING_CONFIGURATION, {
    client: apolloCoreClient,
    refetchQueries: [{ query: GET_O2D_BRANDING_CONFIGURATIONS }],
    awaitRefetchQueries: true,
  });

  const [updateDraft, { loading: isSavingDraft }] = useMutation<{
    updateO2dBrandingDraft: O2dBrandingAdminConfiguration;
  }>(UPDATE_O2D_BRANDING_DRAFT, { client: apolloCoreClient });

  const [validateDraft, { loading: isValidating }] = useMutation<{
    validateO2dBrandingDraft: O2dBrandingAdminValidationResult;
  }>(VALIDATE_O2D_BRANDING_DRAFT, { client: apolloCoreClient });

  const [publishConfiguration, { loading: isPublishing }] = useMutation(
    PUBLISH_O2D_BRANDING_CONFIGURATION,
    { client: apolloCoreClient },
  );

  const [rollbackConfiguration, { loading: isRollingBack }] = useMutation(
    ROLLBACK_O2D_BRANDING_CONFIGURATION,
    { client: apolloCoreClient },
  );

  return {
    configuration,
    configurationsLoading,
    versions: versionsData?.o2dBrandingVersions ?? [],
    refetchAll,
    createConfiguration,
    updateDraft,
    validateDraft,
    publishConfiguration,
    rollbackConfiguration,
    isBusy:
      isCreating ||
      isSavingDraft ||
      isValidating ||
      isPublishing ||
      isRollingBack,
    isSavingDraft,
    isValidating,
    isPublishing,
  };
};
