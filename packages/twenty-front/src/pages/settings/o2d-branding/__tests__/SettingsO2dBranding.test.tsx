import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { getO2dDefaultBrandColor } from '@/o2d-branding/utils/getO2dDefaultBrandColor';
import { SettingsO2dBranding } from '~/pages/settings/o2d-branding/SettingsO2dBranding';

const mockUseO2dBrandingAdmin = jest.fn();

jest.mock('@/o2d-branding/hooks/useO2dBrandingAdmin', () => ({
  useO2dBrandingAdmin: () => mockUseO2dBrandingAdmin(),
}));

jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: () => ({
    enqueueSuccessSnackBar: jest.fn(),
    enqueueErrorSnackBar: jest.fn(),
  }),
}));

jest.mock('@/settings/components/SettingsPageContainer', () => ({
  SettingsPageContainer: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@/settings/components/layout/SettingsPageLayout', () => ({
  SettingsPageLayout: ({
    children,
    actionButton,
  }: {
    children: ReactNode;
    actionButton?: ReactNode;
  }) => (
    <>
      {actionButton}
      {children}
    </>
  ),
}));

jest.mock(
  '@/settings/components/SaveAndCancelButtons/SaveAndCancelButtons',
  () => ({
    SaveAndCancelButtons: () => <div data-testid="save-and-cancel" />,
  }),
);

const baseAdminState = {
  configurationsLoading: false,
  versions: [],
  assets: [],
  validationRun: null,
  refetchAll: jest.fn(),
  refetchAssets: jest.fn(),
  refetchValidationRun: jest.fn(),
  startValidationRunPolling: jest.fn(),
  stopValidationRunPolling: jest.fn(),
  createConfiguration: jest.fn(),
  updateDraft: jest.fn(),
  uploadAsset: jest.fn(),
  startDraftValidation: jest.fn(),
  previewDraft: jest.fn(),
  fetchVersionDiff: jest.fn(),
  publishConfiguration: jest.fn(),
  rollbackConfiguration: jest.fn(),
  restoreVersionAsDraft: jest.fn(),
  isBusy: false,
  isSavingDraft: false,
  isUploadingAsset: false,
  isValidating: false,
  isPreviewLoading: false,
  isPublishing: false,
};

const buildConfiguration = () => ({
  id: 'cfg-1',
  name: 'Padrão',
  status: 'ACTIVE',
  publishedVersionId: 'v-2',
  draftHash: 'hash-current',
  draftUpdatedAt: '2026-08-06T00:00:00Z',
  schemaVersion: 'o2d.branding.config/1-0-0',
  createdAt: '2026-08-06T00:00:00Z',
  updatedAt: '2026-08-06T00:00:00Z',
  draftConfig: {
    schemaVersion: 'o2d.branding.config/1-0-0',
    basePreset: 'preset.odois',
    brand: { productName: 'óDois CRM', shortName: 'óDois' },
    tokens: { 'brand.primary': getO2dDefaultBrandColor() },
    assets: { favicon: { assetId: 'asset-1', hash: 'cafebabe12345678' } },
  },
});

const buildVersions = () => [
  {
    id: 'v-2',
    number: 2,
    status: 'PUBLISHED',
    hash: 'abc1234567890def',
    adapterVersion: 'o2d-adapter/538b1808@1',
    basedOnVersionId: null,
    changelog: null,
    createdAt: '2026-08-06T00:00:00Z',
    artifact: {
      cssLight: { '--t-color-blue9': getO2dDefaultBrandColor() },
      cssDark: { '--t-color-blue9': getO2dDefaultBrandColor() },
      meta: { adapterVersion: 'o2d-adapter/538b1808@1', hash: 'abc' },
    },
  },
  {
    id: 'v-1',
    number: 1,
    status: 'SUPERSEDED',
    hash: 'def1234567890abc',
    adapterVersion: 'o2d-adapter/538b1808@1',
    basedOnVersionId: null,
    changelog: 'first',
    createdAt: '2026-08-05T00:00:00Z',
    artifact: null,
  },
];

describe('SettingsO2dBranding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers to create a configuration when none exists', () => {
    mockUseO2dBrandingAdmin.mockReturnValue({
      ...baseAdminState,
      configuration: undefined,
    });

    render(<SettingsO2dBranding />);

    expect(screen.getByText('Create configuration')).toBeInTheDocument();
  });

  it('renders brand fields and version history for an existing configuration', () => {
    mockUseO2dBrandingAdmin.mockReturnValue({
      ...baseAdminState,
      configuration: buildConfiguration(),
      versions: buildVersions(),
    });

    render(<SettingsO2dBranding />);

    expect(screen.getByDisplayValue('óDois CRM')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(getO2dDefaultBrandColor()),
    ).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    // Asset slots: favicon shows its pinned hash prefix, logos are unset.
    expect(screen.getByText(/Favicon · cafebabe/)).toBeInTheDocument();
    expect(screen.getAllByText(/not set/)).toHaveLength(2);
    expect(screen.getAllByText('Upload')).toHaveLength(3);
    // Only the non-published version offers restore; every version can be
    // edited as a draft; only versions with a stored artifact can preview.
    expect(screen.getAllByText('Restore')).toHaveLength(1);
    expect(screen.getAllByText('Edit as draft')).toHaveLength(2);
    expect(screen.getByTestId('save-and-cancel')).toBeInTheDocument();
  });

  it('gates publishing on the derived draft state machine', () => {
    mockUseO2dBrandingAdmin.mockReturnValue({
      ...baseAdminState,
      configuration: buildConfiguration(),
      validationRun: {
        id: 'run-1',
        status: 'COMPLETED',
        draftHash: 'hash-current',
        result: { status: 'valid', issues: [] },
        startedAt: '2026-08-06T00:00:00Z',
        finishedAt: '2026-08-06T00:00:01Z',
      },
    });

    render(<SettingsO2dBranding />);

    expect(screen.getByTestId('o2d-branding-draft-status')).toHaveTextContent(
      'Ready to publish',
    );
    expect(screen.getByRole('button', { name: /^Publish/ })).toBeEnabled();
  });

  it('keeps publishing disabled while the draft is unvalidated', () => {
    mockUseO2dBrandingAdmin.mockReturnValue({
      ...baseAdminState,
      configuration: buildConfiguration(),
      validationRun: null,
    });

    render(<SettingsO2dBranding />);

    expect(screen.getByTestId('o2d-branding-draft-status')).toHaveTextContent(
      'Draft',
    );
    expect(screen.getByRole('button', { name: /^Publish/ })).toBeDisabled();
  });

  it('applies the draft preview and shows the exit banner', async () => {
    const previewDraft = jest.fn().mockResolvedValue({
      data: {
        previewO2dBrandingDraft: {
          status: 'valid',
          issues: [],
          artifact: {
            hash: 'a'.repeat(64),
            cssLight: { '--t-color-blue9': getO2dDefaultBrandColor() },
            cssDark: { '--t-color-blue9': getO2dDefaultBrandColor() },
            brand: { productName: 'óDois CRM', shortName: 'óDois' },
            assets: {},
          },
        },
      },
    });

    mockUseO2dBrandingAdmin.mockReturnValue({
      ...baseAdminState,
      configuration: buildConfiguration(),
      previewDraft,
    });

    render(<SettingsO2dBranding />);

    await userEvent.click(screen.getByRole('button', { name: /^Preview/ }));

    expect(previewDraft).toHaveBeenCalledWith({
      variables: { configurationId: 'cfg-1' },
    });
    expect(
      screen.getByTestId('o2d-branding-preview-banner'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /^Exit preview/ }),
    );

    expect(
      screen.queryByTestId('o2d-branding-preview-banner'),
    ).not.toBeInTheDocument();
  });
});
