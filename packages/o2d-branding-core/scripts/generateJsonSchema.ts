import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandingConfigJsonSchema } from '../src/schemas/brandingConfigSchema';

// Emits the interchange contract o2d.branding.config/1-0-0 as JSON Schema.
// The committed file is the artifact other components (server, admin UI,
// bridge) consume; the schema sync test keeps it aligned with the zod source.
const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../schemas/o2d.branding.config-1-0-0.schema.json',
);

writeFileSync(
  outputPath,
  `${JSON.stringify(brandingConfigJsonSchema(), null, 2)}\n`,
);
process.stdout.write(`wrote ${outputPath}\n`);
