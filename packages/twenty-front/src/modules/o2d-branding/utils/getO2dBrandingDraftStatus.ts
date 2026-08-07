import {
  type O2dBrandingAdminValidationRun,
  type O2dBrandingDraftStatus,
} from '@/o2d-branding/types/O2dBrandingAdmin';

// Doc 15 §1 draft states, derived instead of stored: a validation run only
// speaks for the exact draft (by canonical hash) it was started on. Any
// edit changes the hash, so READY_TO_PUBLISH self-invalidates — the doc's
// "qualquer edição posterior retorna a DRAFT" invariant.
export const getO2dBrandingDraftStatus = (
  draftHash: string | null | undefined,
  validationRun: O2dBrandingAdminValidationRun | null | undefined,
): O2dBrandingDraftStatus => {
  if (
    draftHash === null ||
    draftHash === undefined ||
    validationRun === null ||
    validationRun === undefined ||
    validationRun.draftHash !== draftHash
  ) {
    return 'DRAFT';
  }

  if (validationRun.status === 'RUNNING') {
    return 'VALIDATING';
  }

  if (validationRun.status === 'COMPLETED') {
    return validationRun.result?.status === 'valid'
      ? 'READY_TO_PUBLISH'
      : 'VALIDATION_FAILED';
  }

  return 'DRAFT';
};
