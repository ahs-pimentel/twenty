import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import {
  CREATE_O2D_BRANDING_CONFIGURATION,
  GET_O2D_BRANDING_ASSETS,
  GET_O2D_BRANDING_CONFIGURATIONS,
  GET_O2D_BRANDING_VALIDATION_RUN,
  GET_O2D_BRANDING_VERSION_DIFF,
  GET_O2D_BRANDING_VERSIONS,
  PREVIEW_O2D_BRANDING_DRAFT,
  PUBLISH_O2D_BRANDING_CONFIGURATION,
  RESTORE_O2D_BRANDING_VERSION_AS_DRAFT,
  ROLLBACK_O2D_BRANDING_CONFIGURATION,
  START_O2D_BRANDING_DRAFT_VALIDATION,
  UPDATE_O2D_BRANDING_DRAFT,
  UPLOAD_O2D_BRANDING_ASSET,
} from '@/o2d-branding/graphql/o2dBrandingAdminOperations';
import {
  type O2dBrandingAdminAsset,
  type O2dBrandingAdminConfiguration,
  type O2dBrandingAdminDraftPreview,
  type O2dBrandingAdminValidationRun,
  type O2dBrandingAdminVersion,
  type O2dBrandingAdminVersionDiff,
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

  // Async validation run (doc 19): fetched with the page, polled by the
  // caller while a run is in flight (startValidationRunPolling below).
  const {
    data: validationRunData,
    startPolling: startValidationRunPolling,
    stopPolling: stopValidationRunPolling,
    refetch: refetchValidationRun,
  } = useQuery<{
    o2dBrandingValidationRun: O2dBrandingAdminValidationRun | null;
  }>(GET_O2D_BRANDING_VALIDATION_RUN, {
    client: apolloCoreClient,
    variables: { configurationId: configuration?.id },
    skip: configuration === undefined,
    fetchPolicy: 'network-only',
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

  const { data: assetsData, refetch: refetchAssets } = useQuery<{
    o2dBrandingAssets: O2dBrandingAdminAsset[];
  }>(GET_O2D_BRANDING_ASSETS, {
    client: apolloCoreClient,
    variables: { configurationId: configuration?.id },
    skip: configuration === undefined,
  });

  const [uploadAsset, { loading: isUploadingAsset }] = useMutation<{
    uploadO2dBrandingAsset: O2dBrandingAdminAsset;
  }>(UPLOAD_O2D_BRANDING_ASSET, { client: apolloCoreClient });

  const [startDraftValidation, { loading: isValidating }] = useMutation<{
    startO2dBrandingDraftValidation: O2dBrandingAdminValidationRun;
  }>(START_O2D_BRANDING_DRAFT_VALIDATION, { client: apolloCoreClient });

  // Draft preview is generated on demand and never cached — a stale
  // preview would defeat its purpose (doc 14 §3).
  const [previewDraft, { loading: isPreviewLoading }] = useLazyQuery<{
    previewO2dBrandingDraft: O2dBrandingAdminDraftPreview;
  }>(PREVIEW_O2D_BRANDING_DRAFT, {
    client: apolloCoreClient,
    fetchPolicy: 'network-only',
  });

  const [fetchVersionDiff] = useLazyQuery<{
    o2dBrandingVersionDiff: O2dBrandingAdminVersionDiff;
  }>(GET_O2D_BRANDING_VERSION_DIFF, { client: apolloCoreClient });

  const [publishConfiguration, { loading: isPublishing }] = useMutation(
    PUBLISH_O2D_BRANDING_CONFIGURATION,
    { client: apolloCoreClient },
  );

  const [rollbackConfiguration, { loading: isRollingBack }] = useMutation(
    ROLLBACK_O2D_BRANDING_CONFIGURATION,
    { client: apolloCoreClient },
  );

  const [restoreVersionAsDraft, { loading: isRestoringAsDraft }] = useMutation<{
    restoreO2dBrandingVersionAsDraft: O2dBrandingAdminConfiguration;
  }>(RESTORE_O2D_BRANDING_VERSION_AS_DRAFT, { client: apolloCoreClient });

  return {
    configuration,
    configurationsLoading,
    versions: versionsData?.o2dBrandingVersions ?? [],
    assets: assetsData?.o2dBrandingAssets ?? [],
    validationRun: validationRunData?.o2dBrandingValidationRun ?? null,
    refetchAll,
    refetchAssets,
    refetchValidationRun,
    startValidationRunPolling,
    stopValidationRunPolling,
    createConfiguration,
    updateDraft,
    uploadAsset,
    startDraftValidation,
    previewDraft,
    fetchVersionDiff,
    publishConfiguration,
    rollbackConfiguration,
    restoreVersionAsDraft,
    isBusy:
      isCreating ||
      isSavingDraft ||
      isUploadingAsset ||
      isValidating ||
      isPublishing ||
      isRollingBack ||
      isRestoringAsDraft,
    isSavingDraft,
    isUploadingAsset,
    isValidating,
    isPreviewLoading,
    isPublishing,
  };
};
