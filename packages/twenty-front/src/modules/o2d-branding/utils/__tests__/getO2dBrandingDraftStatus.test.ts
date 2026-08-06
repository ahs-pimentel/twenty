import { type O2dBrandingAdminValidationRun } from '@/o2d-branding/types/O2dBrandingAdmin';
import { getO2dBrandingDraftStatus } from '@/o2d-branding/utils/getO2dBrandingDraftStatus';

const buildRun = (
  overrides: Partial<O2dBrandingAdminValidationRun> = {},
): O2dBrandingAdminValidationRun => ({
  id: 'run-1',
  status: 'COMPLETED',
  draftHash: 'hash-1',
  result: { status: 'valid', issues: [] },
  startedAt: '2026-08-06T00:00:00Z',
  finishedAt: '2026-08-06T00:00:01Z',
  ...overrides,
});

describe('getO2dBrandingDraftStatus', () => {
  it('should be DRAFT when no validation run exists', () => {
    expect(getO2dBrandingDraftStatus('hash-1', null)).toBe('DRAFT');
  });

  it('should be DRAFT when the run belongs to an older draft', () => {
    expect(
      getO2dBrandingDraftStatus('hash-2', buildRun({ draftHash: 'hash-1' })),
    ).toBe('DRAFT');
  });

  it('should be VALIDATING while the run is in flight', () => {
    expect(
      getO2dBrandingDraftStatus(
        'hash-1',
        buildRun({ status: 'RUNNING', result: null, finishedAt: null }),
      ),
    ).toBe('VALIDATING');
  });

  it('should be READY_TO_PUBLISH when the current draft validated cleanly', () => {
    expect(getO2dBrandingDraftStatus('hash-1', buildRun())).toBe(
      'READY_TO_PUBLISH',
    );
  });

  it('should be VALIDATION_FAILED when the current draft has blocking issues', () => {
    expect(
      getO2dBrandingDraftStatus(
        'hash-1',
        buildRun({ result: { status: 'failed', issues: [] } }),
      ),
    ).toBe('VALIDATION_FAILED');
  });

  it('should be DRAFT when the run itself failed (stale or infra error)', () => {
    expect(
      getO2dBrandingDraftStatus('hash-1', buildRun({ status: 'FAILED' })),
    ).toBe('DRAFT');
  });
});
