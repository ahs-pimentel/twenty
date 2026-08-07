import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// o2d-branding phase 4 (doc 15 §4): versions store the exact source config
// that produced their snapshot so an old-adapter version can be restored as
// an editable draft instead of being rolled back verbatim. Nullable —
// versions published before this column simply cannot be restored as
// drafts (surfaced as a 422 by the service).
@RegisteredInstanceCommand('2.17.0', 1801100000001)
export class AddO2dBrandingVersionSourceConfigFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."o2dBrandingVersion"
        ADD COLUMN IF NOT EXISTS "sourceConfig" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."o2dBrandingVersion"
        DROP COLUMN IF EXISTS "sourceConfig"`,
    );
  }
}
