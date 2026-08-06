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
import { useO2dBrandingAdmin } from '@/o2d-branding/hooks/useO2dBrandingAdmin';
import { getO2dDefaultBrandColor } from '@/o2d-branding/utils/getO2dDefaultBrandColor';
import {
  type O2dBrandingAdminValidationIssue,
  type O2dBrandingAdminVersion,
} from '@/o2d-branding/types/O2dBrandingAdmin';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

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

const StyledVersionRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledActionsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
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
    refetchAll,
    refetchAssets,
    createConfiguration,
    updateDraft,
    uploadAsset,
    validateDraft,
    publishConfiguration,
    rollbackConfiguration,
    isBusy,
    isSavingDraft,
    isValidating,
    isPublishing,
  } = useO2dBrandingAdmin();

  const [productName, setProductName] = useState('');
  const [shortName, setShortName] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [issues, setIssues] = useState<O2dBrandingAdminValidationIssue[]>([]);
  const [activeUploadSlot, setActiveUploadSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (configuration?.draftConfig) {
      setProductName(configuration.draftConfig.brand.productName);
      setShortName(configuration.draftConfig.brand.shortName);

      const brandPrimary = configuration.draftConfig.tokens['brand.primary'];

      setBrandColor(typeof brandPrimary === 'string' ? brandPrimary : '');
    }
  }, [configuration]);

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

  const handleValidate = async () => {
    if (configuration === undefined) {
      return;
    }

    try {
      const { data } = await validateDraft({
        variables: { id: configuration.id },
      });
      const result = data?.validateO2dBrandingDraft;

      setIssues(result?.issues ?? []);

      if (result?.status === 'valid') {
        enqueueSuccessSnackBar({ message: t`Draft is valid and publishable` });
      } else {
        enqueueErrorSnackBar({ message: t`Draft has blocking issues` });
      }
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handlePublish = async () => {
    if (configuration === undefined) {
      return;
    }

    try {
      await publishConfiguration({ variables: { id: configuration.id } });
      await refetchAll();
      setIssues([]);
      enqueueSuccessSnackBar({ message: t`Branding published` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
    }
  };

  const handleRollback = async (version: O2dBrandingAdminVersion) => {
    if (configuration === undefined || rollbackReason.trim() === '') {
      enqueueErrorSnackBar({ message: t`A rollback reason is required` });

      return;
    }

    try {
      await rollbackConfiguration({
        variables: {
          id: configuration.id,
          toVersion: version.number,
          reason: rollbackReason.trim(),
        },
      });
      await refetchAll();
      setRollbackReason('');
      enqueueSuccessSnackBar({ message: t`Rolled back` });
    } catch (error) {
      enqueueErrorSnackBar({ message: (error as Error).message });
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
                description={t`Validation runs the full accessibility and token pipeline; publishing creates an immutable version.`}
              />
              <StyledActionsRow>
                <Button
                  title={t`Validate`}
                  disabled={isBusy}
                  onClick={handleValidate}
                />
                <Button
                  title={isPublishing ? t`Publishing...` : t`Publish`}
                  accent="blue"
                  disabled={isBusy || isValidating}
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
            <Section>
              <H2Title
                title={t`Versions`}
                description={t`Published history. Restoring creates a new version based on the selected one.`}
              />
              <SettingsTextInput
                instanceId="o2d-branding-rollback-reason"
                label={t`Rollback reason`}
                value={rollbackReason}
                onChange={setRollbackReason}
                placeholder={t`Required to restore a version`}
                fullWidth
              />
              {versions.map((version) => (
                <StyledVersionRow key={version.id}>
                  <span>
                    v{version.number} · {version.status} ·{' '}
                    {new Date(version.createdAt).toLocaleString()}
                    {version.changelog ? ` · ${version.changelog}` : ''}
                  </span>
                  {version.status !== 'PUBLISHED' && (
                    <Button
                      title={t`Restore`}
                      size="small"
                      disabled={isBusy}
                      onClick={() => handleRollback(version)}
                    />
                  )}
                </StyledVersionRow>
              ))}
            </Section>
          </>
        )}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
