import { t } from '@lingui/core/macro';
import { useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import {
  type O2dBrandingAdminVersion,
  type O2dBrandingAdminVersionDiff,
} from '@/o2d-branding/types/O2dBrandingAdmin';

type O2dBrandingVersionHistoryProps = {
  versions: O2dBrandingAdminVersion[];
  isBusy: boolean;
  onRollback: (version: O2dBrandingAdminVersion, reason: string) => void;
  onRestoreAsDraft: (version: O2dBrandingAdminVersion) => void;
  onPreviewVersion: (version: O2dBrandingAdminVersion) => void;
  onFetchDiff: (
    fromNumber: number,
    toNumber: number,
  ) => Promise<O2dBrandingAdminVersionDiff | undefined>;
};

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

const StyledVersionActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledDiffList = styled.ul`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[1]} 0;
  padding-left: ${themeCssVariables.spacing[5]};
`;

// Published history with the doc 15 actions: rollback (new version based on
// the selected one), restore-as-draft (edit an old look without touching
// history), per-version preview (applies the stored artifact locally) and
// the automatic token/asset diff against the previous version.
export const O2dBrandingVersionHistory = ({
  versions,
  isBusy,
  onRollback,
  onRestoreAsDraft,
  onPreviewVersion,
  onFetchDiff,
}: O2dBrandingVersionHistoryProps) => {
  const [rollbackReason, setRollbackReason] = useState('');
  const [expandedDiffVersionId, setExpandedDiffVersionId] = useState<
    string | null
  >(null);
  const [diffsByVersionId, setDiffsByVersionId] = useState<
    Record<string, O2dBrandingAdminVersionDiff>
  >({});

  const handleToggleDiff = async (
    version: O2dBrandingAdminVersion,
    previousVersion: O2dBrandingAdminVersion,
  ) => {
    if (expandedDiffVersionId === version.id) {
      setExpandedDiffVersionId(null);

      return;
    }

    if (diffsByVersionId[version.id] === undefined) {
      const diff = await onFetchDiff(previousVersion.number, version.number);

      if (diff === undefined) {
        return;
      }

      setDiffsByVersionId((previousDiffs) => ({
        ...previousDiffs,
        [version.id]: diff,
      }));
    }

    setExpandedDiffVersionId(version.id);
  };

  return (
    <Section>
      <H2Title
        title={t`Versions`}
        description={t`Published history. Restoring creates a new version based on the selected one; editing as draft never touches history.`}
      />
      <SettingsTextInput
        instanceId="o2d-branding-rollback-reason"
        label={t`Rollback reason`}
        value={rollbackReason}
        onChange={setRollbackReason}
        placeholder={t`Required to restore a version`}
        fullWidth
      />
      {versions.map((version, index) => {
        // versions arrive number-DESC, so the previous version is the next
        // item — the diff baseline of the automatic changelog (doc 15 §2).
        const previousVersion = versions[index + 1];
        const diff = diffsByVersionId[version.id];

        return (
          <div key={version.id}>
            <StyledVersionRow>
              <span>
                v{version.number} · {version.status} ·{' '}
                {version.hash.slice(0, 8)} ·{' '}
                {new Date(version.createdAt).toLocaleString()}
                {version.changelog ? ` · ${version.changelog}` : ''}
              </span>
              <StyledVersionActions>
                {version.artifact !== null && (
                  <Button
                    title={t`Preview`}
                    size="small"
                    disabled={isBusy}
                    onClick={() => onPreviewVersion(version)}
                  />
                )}
                {previousVersion !== undefined && (
                  <Button
                    title={t`Diff`}
                    size="small"
                    onClick={() => handleToggleDiff(version, previousVersion)}
                  />
                )}
                {version.status !== 'PUBLISHED' && (
                  <Button
                    title={t`Restore`}
                    size="small"
                    disabled={isBusy}
                    onClick={() => onRollback(version, rollbackReason.trim())}
                  />
                )}
                <Button
                  title={t`Edit as draft`}
                  size="small"
                  disabled={isBusy}
                  onClick={() => onRestoreAsDraft(version)}
                />
              </StyledVersionActions>
            </StyledVersionRow>
            {expandedDiffVersionId === version.id && diff !== undefined && (
              <StyledDiffList
                data-testid={`o2d-version-diff-${version.number}`}
              >
                {diff.tokenChanges.length === 0 &&
                  diff.assetChanges.length === 0 && (
                    <li>{t`No token or asset changes`}</li>
                  )}
                {diff.tokenChanges.map((change) => (
                  <li key={`${change.tokenPath}-${change.mode}`}>
                    {change.tokenPath} ({change.mode}): {change.from ?? '—'} →{' '}
                    {change.to ?? '—'}
                  </li>
                ))}
                {diff.assetChanges.map((change) => (
                  <li key={`asset-${change.slot}`}>
                    {change.slot}: {change.fromHash?.slice(0, 8) ?? '—'} →{' '}
                    {change.toHash?.slice(0, 8) ?? '—'}
                  </li>
                ))}
              </StyledDiffList>
            )}
          </div>
        );
      })}
    </Section>
  );
};
