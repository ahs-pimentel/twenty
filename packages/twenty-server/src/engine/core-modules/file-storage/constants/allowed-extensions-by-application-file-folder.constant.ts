import { FileFolder } from 'twenty-shared/types';

export const ALLOWED_EXTENSIONS_BY_APPLICATION_FILE_FOLDER = {
  [FileFolder.BuiltLogicFunction]: { '.mjs': true },
  [FileFolder.BuiltFrontComponent]: { '.mjs': true },
  [FileFolder.Source]: { '.ts': true, '.tsx': true, '.json': true },
  [FileFolder.Dependencies]: { '.json': true, '.lock': true },
  // O2D-PATCH: P8 — storage-layer backstop; the branding pipeline enforces
  // stricter per-slot rules before reaching this point.
  [FileFolder.BrandingAsset]: {
    '.svg': true,
    '.png': true,
    '.webp': true,
    '.ico': true,
  },
} as const satisfies Partial<Record<FileFolder, Record<string, true>>>;
