import { type O2dBrandingRuntimeArtifact } from '@/o2d-branding/states/o2dBrandingArtifactState';

const STORAGE_KEY = 'o2dBrandingArtifact';

// Hash-versioned local cache (doc 08 §4, strategy 2): returning visitors get
// the last published artifact synchronously before revalidation. Storage
// failures are never fatal — the embedded artifact remains the floor.
export const readO2dBrandingCache = (
  storage: Pick<Storage, 'getItem'>,
): O2dBrandingRuntimeArtifact | null => {
  try {
    const raw = storage.getItem(STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as O2dBrandingRuntimeArtifact;

    if (
      typeof parsed?.hash !== 'string' ||
      typeof parsed?.css?.light !== 'object' ||
      typeof parsed?.css?.dark !== 'object' ||
      typeof parsed?.brand?.productName !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const writeO2dBrandingCache = (
  storage: Pick<Storage, 'setItem'>,
  artifact: O2dBrandingRuntimeArtifact,
): void => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(artifact));
  } catch {
    // Quota/security errors are ignored — cache is best-effort.
  }
};
