import { render, screen } from '@testing-library/react';
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
  refetchAll: jest.fn(),
  createConfiguration: jest.fn(),
  updateDraft: jest.fn(),
  validateDraft: jest.fn(),
  publishConfiguration: jest.fn(),
  rollbackConfiguration: jest.fn(),
  isBusy: false,
  isSavingDraft: false,
  isValidating: false,
  isPublishing: false,
};

describe('SettingsO2dBranding', () => {
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
      configuration: {
        id: 'cfg-1',
        name: 'Padrão',
        status: 'ACTIVE',
        publishedVersionId: 'v-2',
        draftUpdatedAt: '2026-08-06T00:00:00Z',
        schemaVersion: 'o2d.branding.config/1-0-0',
        createdAt: '2026-08-06T00:00:00Z',
        updatedAt: '2026-08-06T00:00:00Z',
        draftConfig: {
          schemaVersion: 'o2d.branding.config/1-0-0',
          basePreset: 'preset.odois',
          brand: { productName: 'óDois CRM', shortName: 'óDois' },
          tokens: { 'brand.primary': getO2dDefaultBrandColor() },
          assets: {},
        },
      },
      versions: [
        {
          id: 'v-2',
          number: 2,
          status: 'PUBLISHED',
          hash: 'abc',
          adapterVersion: 'o2d-adapter/538b1808@1',
          changelog: null,
          createdAt: '2026-08-06T00:00:00Z',
        },
        {
          id: 'v-1',
          number: 1,
          status: 'SUPERSEDED',
          hash: 'def',
          adapterVersion: 'o2d-adapter/538b1808@1',
          changelog: 'first',
          createdAt: '2026-08-05T00:00:00Z',
        },
      ],
    });

    render(<SettingsO2dBranding />);

    expect(screen.getByDisplayValue('óDois CRM')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(getO2dDefaultBrandColor()),
    ).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Publish')).toBeInTheDocument();
    // Only the non-published version offers restore.
    expect(screen.getAllByText('Restore')).toHaveLength(1);
    expect(screen.getByTestId('save-and-cancel')).toBeInTheDocument();
  });
});
