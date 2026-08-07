import { t } from '@lingui/core/macro';
import { useEffect, useRef, useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { ColorSample } from 'twenty-ui/data-display';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { getSettingsPath } from 'twenty-shared/utils';
import { SettingsPath } from 'twenty-shared/types';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SaveAndCancelButtons } from '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { O2dBrandingDomainsSection } from '@/o2d-branding/components/O2dBrandingDomainsSection';
import { O2dBrandingVersionHistory } from '@/o2d-branding/components/O2dBrandingVersionHistory';
import { useO2dBrandingAdmin } from '@/o2d-branding/hooks/useO2dBrandingAdmin';
import { o2dBrandingArtifactState } from '@/o2d-branding/states/o2dBrandingArtifactState';
import { applyO2dBrandingStylesheet } from '@/o2d-branding/utils/applyO2dBrandingStylesheet';
import { getO2dBrandingDraftStatus } from '@/o2d-branding/utils/getO2dBrandingDraftStatus';
import { getO2dDefaultBrandColor } from '@/o2d-branding/utils/getO2dDefaultBrandColor';
import {
  type O2dBrandingAdminDomain,
  type O2dBrandingAdminValidationIssue,
  type O2dBrandingAdminVersion,
  type O2dBrandingDraftStatus,
} from '@/o2d-branding/types/O2dBrandingAdmin';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

const VALIDATION_RUN_POLL_INTERVAL_MS = 1500;

// Uploadable slots surfaced in the MVP admin UI (doc 11 §2); the accept
// list mirrors the server-side per-slot format allowlist.
const UPLOADABLE_ASSET_SLOTS: {
  slot: string;
  label: string;
  accept: string;
}[] = [
  { slot: 'favicon', label: 'Favicon', accept: '.ico,.png,.svg' },
  { slot: 'logoLight', label: 'Logo (light)', accept: '.svg,.png,.webp' },
  { slot: 'logoDark', label: 'Logo (dark)', accept: '.svg,.png,.webp' },
];

const DRAFT_STATUS_LABELS: Record<O2dBrandingDraftStatus, () => string> = {
  DRAFT: () => t`Draft`,
  VALIDATING: () => t`Validating…`,
  VALIDATION_FAILED: () => t`Validation failed`,
  READY_TO_PUBLISH: () => t`Ready to publish`,
};

const StyledColorRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledIssueList = styled.ul`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[2]} 0 0;
  padding-left: ${themeCssVariables.spacing[5]};
`;

const StyledActionsRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledDraftStatusChip = styled.span`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledPreviewBanner = styled.div`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledAssetRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledHiddenFileInput = styled.input`
  display: none;
`;

export const SettingsO2dBranding = () => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const {
    configuration,
    configurationsLoading,
    versions,
    domains,
    validationRun,
    refetchAll,
    refetchAssets,
    refetchDomains,
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
    upsertDomain,
    removeDomain,
    isBusy,
    isSavingDraft,
    isPreviewLoading,
    isPublishing,
  } = useO2dBrandingAdmin();

  const o2dBrandingArtifact = useAtomStateValue(o2dBrandingArtifactState);

  const [productName, setProductName] = useState('');
  const [shortName, setShortName] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [previewIssues, setPreviewIssues] = useState<
    O2dBrandingAdminValidationIssue[]
  >([]);
  const [activePreview, setActivePreview] = useState<{
    label: string;
    hash: string;
    cssLight: Record<string, string>;
    cssDark: Record<string, string>;
  } | null>(null);
  const [activeUploadSlot, setActiveUploadSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview is a stylesheet swap on this document only; the cleanup
  // restores the published artifact on exit, switch or unmount — leaving
  // the page must never keep a draft theme applied (doc 14 §5).
  useEffect(() => {
    if (activePreview === null) {
      return;
    }

    applyO2dBrandingStylesheet(document, {
      hash: `preview:${activePreview.hash}`,
      css: { light: activePreview.cssLight, dark: activePreview.cssDark },
    });

    return () => {
      applyO2dBrandingStylesheet(document, o2dBrandingArtifact);
    };
  }, [activePreview, o2dBrandingArtifact]);

  useEffect(() => {
    if (configuration?.draftConfig) {
      setProductName(configuration.draftConfig.brand.productName);
      setShortName(configuration.draftConfig.brand.shortName);

      const brandPrimary = configuration.draftConfig.tokens['brand.primary'];

      setBrandColor(typeof brandPrimary === 'string' ? brandPrimary : '');
    }
  }, [configuration]);

  const draftStatus = getO2dBrandingDraftStatus(
    configuration?.draftHash,
    validationRun,
  );

  useEffect(() => {
    if (validationRun !== null && validationRun.status !== 'RUNNING') {
      stopValidationRunPolling();
    }
  }, [validationRun, stopValidationRunPolling]);

  const validationIssues =
    validationRun !== null &&
    validationRun.draftHash === configuration?.draftHash
      ? (validationRun.result?.issues ?? [])
      : [];
  const issues = [...validationIssues, ...previewIssues];

  const hasValidColor = brandColor === '' || HEX_COLOR_PATTERN.test(brandColor);

  const canSave =
    configuration !== undefined &&
    productName.trim() !== '' &&
    shortName.trim() !== '' &&
    hasValidColor &&
    !isBusy;

  const buildDraft = () => {
    if (!configuration?.draftConfig) {
      return null;
    }

    const tokens = { ...configuration.draftConfig.tokens };

    if (brandColor === '') {
      delete tokens['brand.primary'];
    } else {
      tokens['brand.primary'] = brandColor.toLowerCase();
    }

    return {
      ...configuration.draftConfig,
      brand: {
        ...configuration.draftConfig.brand,
        productName: productName.trim(),
        shortName: shortName.trim(),
      },
      tokens,
    };
  };

  const handleCreate = async () => {
    try {
      await createConfiguration({
        variables: { name: 'Padrão', basePreset: 'preset.odois' },
      });
      enqueueSuccessSnackBar({ message: t`Branding configuration created` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleSaveDraft = async () => {
    const draft = buildDraft();

    if (configuration === undefined || draft === null) {
      return;
    }

    try {
      await updateDraft({
        variables: {
          id: configuration.id,
          draftConfig: draft,
          expectedDraftUpdatedAt: configuration.draftUpdatedAt,
        },
      });
      await refetchAll();
      enqueueSuccessSnackBar({ message: t`Draft saved` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handlePickAssetFile = (slot: string, accept: string) => {
    if (fileInputRef.current === null) {
      return;
    }

    setActiveUploadSlot(slot);
    fileInputRef.current.accept = accept;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  // Upload runs the server ingestion pipeline; on success the returned
  // id+hash pair is pinned into the draft so the next publish snapshots it
  // (doc 11 §5 — manifests reference exact hashes).
  const handleUploadAssetFile = async (file: File | undefined) => {
    if (
      file === undefined ||
      activeUploadSlot === null ||
      configuration?.draftConfig === undefined ||
      configuration?.draftConfig === null
    ) {
      return;
    }

    try {
      const { data } = await uploadAsset({
        variables: {
          configurationId: configuration.id,
          slot: activeUploadSlot,
          file,
        },
      });
      const asset = data?.uploadO2dBrandingAsset;

      if (asset === undefined || asset.url === null) {
        throw new Error(t`Upload failed`);
      }

      await updateDraft({
        variables: {
          id: configuration.id,
          draftConfig: {
            ...configuration.draftConfig,
            assets: {
              ...configuration.draftConfig.assets,
              [activeUploadSlot]: { assetId: asset.id, hash: asset.hash },
            },
          },
          expectedDraftUpdatedAt: configuration.draftUpdatedAt,
        },
      });
      await refetchAll();
      await refetchAssets();
      enqueueSuccessSnackBar({ message: t`Asset uploaded and set in draft` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    } finally {
      setActiveUploadSlot(null);
    }
  };

  // Async validation (doc 19): the mutation answers with a RUNNING run and
  // the worker fills in the result — polled here until it completes.
  const handleValidate = async () => {
    if (configuration === undefined) {
      return;
    }

    try {
      setPreviewIssues([]);
      await startDraftValidation({ variables: { id: configuration.id } });
      await refetchValidationRun();
      startValidationRunPolling(VALIDATION_RUN_POLL_INTERVAL_MS);
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleExitPreview = () => {
    setActivePreview(null);
  };

  // Draft preview (doc 14): ephemeral server artifact applied on this
  // document only — the published theme and other users stay untouched.
  const handlePreviewDraft = async () => {
    if (configuration === undefined) {
      return;
    }

    const { data } = await previewDraft({
      variables: { configurationId: configuration.id },
    });
    const preview = data?.previewO2dBrandingDraft;

    if (preview === undefined) {
      enqueueErrorSnackBar({ message: t`Preview failed` });

      return;
    }

    if (preview.status !== 'valid' || preview.artifact === null) {
      setPreviewIssues(preview.issues);
      enqueueErrorSnackBar({ message: t`Draft has blocking issues` });

      return;
    }

    setPreviewIssues([]);
    setActivePreview({
      label: t`Previewing draft`,
      hash: preview.artifact.hash,
      cssLight: preview.artifact.cssLight,
      cssDark: preview.artifact.cssDark,
    });
  };

  const handlePreviewVersion = (version: O2dBrandingAdminVersion) => {
    if (version.artifact === null) {
      return;
    }

    setActivePreview({
      label: t`Previewing version` + ` v${version.number}`,
      hash: version.artifact.meta.hash,
      cssLight: version.artifact.cssLight,
      cssDark: version.artifact.cssDark,
    });
  };

  const handlePublish = async () => {
    if (configuration === undefined) {
      return;
    }

    try {
      await publishConfiguration({ variables: { id: configuration.id } });
      await refetchAll();
      enqueueSuccessSnackBar({ message: t`Branding published` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleRollback = async (
    version: O2dBrandingAdminVersion,
    reason: string,
  ) => {
    if (configuration === undefined || reason === '') {
      enqueueErrorSnackBar({ message: t`A rollback reason is required` });

      return;
    }

    try {
      await rollbackConfiguration({
        variables: {
          id: configuration.id,
          toVersion: version.number,
          reason,
        },
      });
      await refetchAll();
      enqueueSuccessSnackBar({ message: t`Rolled back` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleRestoreAsDraft = async (version: O2dBrandingAdminVersion) => {
    if (configuration === undefined) {
      return;
    }

    try {
      await restoreVersionAsDraft({
        variables: { id: configuration.id, versionNumber: version.number },
      });
      await refetchAll();
      enqueueSuccessSnackBar({
        message: t`Version restored as the editable draft`,
      });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleUpsertDomain = async (hostname: string) => {
    try {
      await upsertDomain({ variables: { hostname } });
      await refetchDomains();
      enqueueSuccessSnackBar({ message: t`Domain added` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleRemoveDomain = async (domain: O2dBrandingAdminDomain) => {
    try {
      await removeDomain({ variables: { hostname: domain.hostname } });
      await refetchDomains();
      enqueueSuccessSnackBar({ message: t`Domain removed` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleFetchDiff = async (fromNumber: number, toNumber: number) => {
    if (configuration === undefined) {
      return undefined;
    }

    try {
      const { data } = await fetchVersionDiff({
        variables: { configurationId: configuration.id, fromNumber, toNumber },
      });

      return data?.o2dBrandingVersionDiff;
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });

      return undefined;
    }
  };

  return (
    <SettingsPageLayout
      title={t`Visual identity`}
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.General),
        },
        { children: t`Visual identity` },
      ]}
      actionButton={
        configuration !== undefined ? (
          <SaveAndCancelButtons
            isSaveDisabled={!canSave}
            isLoading={isSavingDraft}
            onCancel={refetchAll}
            onSave={handleSaveDraft}
          />
        ) : undefined
      }
    >
      <SettingsPageContainer>
        {activePreview !== null && (
          <StyledPreviewBanner data-testid="o2d-branding-preview-banner">
            <span>
              {activePreview.label} — {t`the published theme is untouched`}
            </span>
            <Button
              title={t`Exit preview`}
              size="small"
              onClick={handleExitPreview}
            />
          </StyledPreviewBanner>
        )}
        {configuration === undefined ? (
          <Section>
            <H2Title
              title={t`Branding`}
              description={t`Create the workspace branding configuration to customize colors and identity.`}
            />
            <Button
              title={t`Create configuration`}
              disabled={configurationsLoading || isBusy}
              onClick={handleCreate}
            />
          </Section>
        ) : (
          <>
            <Section>
              <H2Title
                title={t`Brand`}
                description={t`Product name shown in titles, sidebar defaults and login.`}
              />
              <SettingsTextInput
                instanceId="o2d-branding-product-name"
                label={t`Product name`}
                value={productName}
                onChange={setProductName}
                fullWidth
              />
              <SettingsTextInput
                instanceId="o2d-branding-short-name"
                label={t`Short name`}
                value={shortName}
                onChange={setShortName}
                fullWidth
              />
            </Section>
            <Section>
              <H2Title
                title={t`Brand color`}
                description={t`Hex color that generates the full brand scale for light and dark themes. Leave empty to keep the preset color.`}
              />
              <StyledColorRow>
                <ColorSample
                  colorName="blue"
                  color={brandColor || getO2dDefaultBrandColor()}
                />
                <SettingsTextInput
                  instanceId="o2d-branding-brand-color"
                  label={t`Brand color (hex)`}
                  value={brandColor}
                  onChange={setBrandColor}
                  placeholder={getO2dDefaultBrandColor()}
                />
              </StyledColorRow>
              {!hasValidColor && (
                <StyledIssueList>
                  <li>{t`Use a 6-digit hex color`}</li>
                </StyledIssueList>
              )}
            </Section>
            <Section>
              <H2Title
                title={t`Assets`}
                description={t`Favicon and logos. Files are validated and sanitized server-side; the published version pins exact file hashes.`}
              />
              <StyledHiddenFileInput
                type="file"
                data-testid="o2d-branding-asset-file-input"
                ref={fileInputRef}
                onChange={(event) =>
                  handleUploadAssetFile(event.target.files?.[0])
                }
              />
              {UPLOADABLE_ASSET_SLOTS.map(({ slot, label, accept }) => {
                const draftAssetRef = configuration.draftConfig?.assets?.[slot];

                return (
                  <StyledAssetRow key={slot}>
                    <span>
                      {label}
                      {draftAssetRef !== undefined
                        ? ` · ${draftAssetRef.hash.slice(0, 8)}`
                        : ` · ${t`not set`}`}
                    </span>
                    <Button
                      title={t`Upload`}
                      size="small"
                      disabled={isBusy}
                      onClick={() => handlePickAssetFile(slot, accept)}
                    />
                  </StyledAssetRow>
                );
              })}
            </Section>
            <Section>
              <H2Title
                title={t`Validation and publication`}
                description={t`Preview applies the draft to this window only. Validation runs the full pipeline in the background; publishing requires a validated draft and creates an immutable version.`}
              />
              <StyledActionsRow>
                <StyledDraftStatusChip data-testid="o2d-branding-draft-status">
                  {DRAFT_STATUS_LABELS[draftStatus]()}
                </StyledDraftStatusChip>
                <Button
                  title={isPreviewLoading ? t`Loading preview...` : t`Preview`}
                  disabled={isBusy || isPreviewLoading}
                  onClick={handlePreviewDraft}
                />
                <Button
                  title={t`Validate`}
                  disabled={isBusy || draftStatus === 'VALIDATING'}
                  onClick={handleValidate}
                />
                <Button
                  title={isPublishing ? t`Publishing...` : t`Publish`}
                  accent="blue"
                  disabled={isBusy || draftStatus !== 'READY_TO_PUBLISH'}
                  onClick={handlePublish}
                />
              </StyledActionsRow>
              {issues.length > 0 && (
                <StyledIssueList>
                  {issues.map((issue, index) => (
                    <li key={`${issue.rule}-${issue.tokenPath}-${index}`}>
                      [{issue.severity}] {issue.rule}
                      {issue.tokenPath ? ` · ${issue.tokenPath}` : ''}
                      {issue.mode ? ` (${issue.mode})` : ''} — {issue.message}
                    </li>
                  ))}
                </StyledIssueList>
              )}
            </Section>
            <O2dBrandingDomainsSection
              domains={domains}
              isBusy={isBusy}
              onUpsert={handleUpsertDomain}
              onRemove={handleRemoveDomain}
            />
            <O2dBrandingVersionHistory
              versions={versions}
              isBusy={isBusy}
              onRollback={handleRollback}
              onRestoreAsDraft={handleRestoreAsDraft}
              onPreviewVersion={handlePreviewVersion}
              onFetchDiff={handleFetchDiff}
            />
          </>
        )}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
