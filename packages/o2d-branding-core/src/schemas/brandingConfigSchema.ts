import { z } from 'zod';

import { CATALOG_TOKEN_PATHS } from '../tokens/tokenCatalog';

export const BRANDING_CONFIG_SCHEMA_VERSION = 'o2d.branding.config/1-0-0';

const tokenValueSchema = z.union([z.string().max(512), z.number()]);

const modedTokenValueSchema = z
  .object({
    light: tokenValueSchema,
    dark: tokenValueSchema,
  })
  .strict();

const assetRefSchema = z
  .object({
    assetId: z.string().min(1).max(128),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const ASSET_SLOTS = [
  'favicon',
  'logoLight',
  'logoDark',
  'loginBackground',
  'emailLogo',
  'documentLogo',
] as const;

// Structural contract for o2d.branding.config/1-0-0. Unknown fields are
// rejected (doc 06 §4) — additions require a schema version bump. The
// `login`/`emails` sections of doc 06 §2 are deliberately absent: they enter
// in later schema versions (phases 2+/7).
export const brandingConfigSchema = z
  .object({
    schemaVersion: z.literal(BRANDING_CONFIG_SCHEMA_VERSION),
    basePreset: z.string().regex(/^preset\.[a-z0-9-]+$/),
    brand: z
      .object({
        productName: z.string().min(1).max(80),
        shortName: z.string().min(1).max(40),
        description: z.string().max(300).optional(),
      })
      .strict(),
    tokens: z.partialRecord(
      z.enum(CATALOG_TOKEN_PATHS as [string, ...string[]]),
      z.union([tokenValueSchema, modedTokenValueSchema]),
    ),
    assets: z
      .partialRecord(z.enum(ASSET_SLOTS), assetRefSchema),
  })
  .strict();

export type BrandingConfigSchemaInput = z.input<typeof brandingConfigSchema>;

export const brandingConfigJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(brandingConfigSchema) as Record<string, unknown>;
