import { QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

// o2d-branding-init (docs/specs/branding-engine/18): creates the seven
// core."o2dBranding*" tables backing the o2d-branding module. No existing
// table or column is altered. All constraint names are declared explicitly
// and mirrored in the entities (foreignKeyConstraintName), so the schema
// stays deterministic without relying on TypeORM's FK hashes.
//
// NOTE: authored by hand (no DB available at authoring time). Before
// release, verify against a database with
//   npx nx run twenty-server:database:migrate:generate --name o2d-branding-init --type fast
// which should report no diff.
@RegisteredInstanceCommand('2.17.0', 1801100000000)
export class CreateO2dBrandingTablesFastInstanceCommand
  implements FastInstanceCommand
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const createEnum = async (name: string, values: string[]) => {
      await queryRunner.query(
        `DO $$ BEGIN CREATE TYPE "core"."${name}" AS ENUM (${values
          .map((value) => `'${value}'`)
          .join(', ')}); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      );
    };

    await createEnum('o2dBrandingConfiguration_status_enum', [
      'ACTIVE',
      'ARCHIVED',
    ]);
    await createEnum('o2dBrandingVersion_status_enum', [
      'DRAFT',
      'VALIDATING',
      'VALIDATION_FAILED',
      'READY_TO_PUBLISH',
      'PUBLISHED',
      'SUPERSEDED',
      'ROLLED_BACK',
      'ARCHIVED',
    ]);
    await createEnum('o2dBrandingAsset_status_enum', [
      'PROCESSING',
      'VALID',
      'REJECTED',
      'ARCHIVED',
    ]);
    await createEnum('o2dBrandingDomain_status_enum', [
      'ACTIVE',
      'PENDING',
      'DISABLED',
    ]);
    await createEnum('o2dBrandingPublication_environment_enum', [
      'PRODUCTION',
      'PREVIEW',
    ]);
    await createEnum('o2dBrandingPublication_status_enum', [
      'SUCCEEDED',
      'FAILED',
    ]);
    await createEnum('o2dBrandingCompatibilityReport_status_enum', [
      'COMPATIBLE',
      'DEGRADED',
      'INCOMPATIBLE',
    ]);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingConfiguration" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "status" "core"."o2dBrandingConfiguration_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "publishedVersionId" uuid,
        "draftConfig" jsonb,
        "draftUpdatedAt" TIMESTAMP WITH TIME ZONE,
        "draftUpdatedBy" uuid,
        "schemaVersion" character varying NOT NULL DEFAULT 'o2d.branding.config/1-0-0',
        "createdBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "workspaceId" uuid NOT NULL,
        CONSTRAINT "PK_o2dBrandingConfiguration_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_O2D_BRANDING_CONFIGURATION_WORKSPACE_NAME" UNIQUE ("workspaceId", "name"),
        CONSTRAINT "FK_O2D_BRANDING_CONFIGURATION_WORKSPACE" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_O2D_BRANDING_CONFIGURATION_WORKSPACE_ID"
        ON "core"."o2dBrandingConfiguration" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingVersion" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "configurationId" uuid NOT NULL,
        "number" integer NOT NULL,
        "status" "core"."o2dBrandingVersion_status_enum" NOT NULL DEFAULT 'DRAFT',
        "snapshot" jsonb NOT NULL,
        "assetManifest" jsonb NOT NULL DEFAULT '{}',
        "artifact" jsonb,
        "schemaVersion" character varying NOT NULL,
        "adapterVersion" character varying NOT NULL,
        "twentyVersion" jsonb NOT NULL,
        "hash" character varying NOT NULL,
        "basedOnVersionId" uuid,
        "changelog" text,
        "validationResult" jsonb,
        "createdBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_o2dBrandingVersion_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_O2D_BRANDING_VERSION_CONFIGURATION_NUMBER" UNIQUE ("configurationId", "number"),
        CONSTRAINT "FK_O2D_BRANDING_VERSION_CONFIGURATION" FOREIGN KEY ("configurationId") REFERENCES "core"."o2dBrandingConfiguration"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_O2D_BRANDING_VERSION_BASED_ON" FOREIGN KEY ("basedOnVersionId") REFERENCES "core"."o2dBrandingVersion"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_O2D_BRANDING_VERSION_HASH"
        ON "core"."o2dBrandingVersion" ("hash")`,
    );

    await queryRunner.query(
      `DO $$ BEGIN
        ALTER TABLE "core"."o2dBrandingConfiguration"
          ADD CONSTRAINT "FK_O2D_BRANDING_CONFIGURATION_PUBLISHED_VERSION"
          FOREIGN KEY ("publishedVersionId") REFERENCES "core"."o2dBrandingVersion"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingAsset" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "configurationId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "name" character varying NOT NULL,
        "format" character varying NOT NULL,
        "sizeBytes" integer NOT NULL,
        "width" integer,
        "height" integer,
        "hash" character varying NOT NULL,
        "storageKey" character varying NOT NULL,
        "url" character varying,
        "version" integer NOT NULL DEFAULT 1,
        "status" "core"."o2dBrandingAsset_status_enum" NOT NULL DEFAULT 'PROCESSING',
        "rejectionReason" text,
        "createdBy" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_o2dBrandingAsset_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_O2D_BRANDING_ASSET_CONFIG_TYPE_HASH" UNIQUE ("configurationId", "type", "hash"),
        CONSTRAINT "FK_O2D_BRANDING_ASSET_CONFIGURATION" FOREIGN KEY ("configurationId") REFERENCES "core"."o2dBrandingConfiguration"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingDomain" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "hostname" character varying NOT NULL,
        "configurationId" uuid,
        "isVerified" boolean NOT NULL DEFAULT false,
        "isPrimary" boolean NOT NULL DEFAULT false,
        "status" "core"."o2dBrandingDomain_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_o2dBrandingDomain_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_O2D_BRANDING_DOMAIN_HOSTNAME" UNIQUE ("hostname"),
        CONSTRAINT "FK_O2D_BRANDING_DOMAIN_WORKSPACE" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_O2D_BRANDING_DOMAIN_CONFIGURATION" FOREIGN KEY ("configurationId") REFERENCES "core"."o2dBrandingConfiguration"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_O2D_BRANDING_DOMAIN_PRIMARY"
        ON "core"."o2dBrandingDomain" ("workspaceId") WHERE "isPrimary" = true`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingPublication" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "configurationId" uuid NOT NULL,
        "versionId" uuid NOT NULL,
        "environment" "core"."o2dBrandingPublication_environment_enum" NOT NULL DEFAULT 'PRODUCTION',
        "status" "core"."o2dBrandingPublication_status_enum" NOT NULL,
        "publishedBy" uuid,
        "publishedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "validationResult" jsonb,
        "failureReason" text,
        CONSTRAINT "PK_o2dBrandingPublication_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_O2D_BRANDING_PUBLICATION_CONFIGURATION" FOREIGN KEY ("configurationId") REFERENCES "core"."o2dBrandingConfiguration"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_O2D_BRANDING_PUBLICATION_VERSION" FOREIGN KEY ("versionId") REFERENCES "core"."o2dBrandingVersion"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_O2D_BRANDING_PUBLICATION_CONFIGURATION_PUBLISHED_AT"
        ON "core"."o2dBrandingPublication" ("configurationId", "publishedAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingAuditEvent" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "configurationId" uuid,
        "versionId" uuid,
        "workspaceId" uuid,
        "eventType" character varying NOT NULL,
        "actorType" character varying NOT NULL,
        "actorId" character varying,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "correlationId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_o2dBrandingAuditEvent_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_O2D_BRANDING_AUDIT_EVENT_CONFIGURATION_CREATED_AT"
        ON "core"."o2dBrandingAuditEvent" ("configurationId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_O2D_BRANDING_AUDIT_EVENT_CORRELATION_ID"
        ON "core"."o2dBrandingAuditEvent" ("correlationId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."o2dBrandingCompatibilityReport" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "twentyVersion" jsonb NOT NULL,
        "adapterVersion" character varying NOT NULL,
        "status" "core"."o2dBrandingCompatibilityReport_status_enum" NOT NULL,
        "conflicts" jsonb NOT NULL DEFAULT '[]',
        "warnings" jsonb NOT NULL DEFAULT '[]',
        "testsSummary" jsonb,
        "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "syncRunId" character varying,
        CONSTRAINT "PK_o2dBrandingCompatibilityReport_id" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."o2dBrandingConfiguration" DROP CONSTRAINT IF EXISTS "FK_O2D_BRANDING_CONFIGURATION_PUBLISHED_VERSION"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."o2dBrandingCompatibilityReport"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."o2dBrandingAuditEvent"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."o2dBrandingPublication"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."o2dBrandingDomain"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."o2dBrandingAsset"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."o2dBrandingVersion"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "core"."o2dBrandingConfiguration"`,
    );

    for (const enumName of [
      'o2dBrandingCompatibilityReport_status_enum',
      'o2dBrandingPublication_status_enum',
      'o2dBrandingPublication_environment_enum',
      'o2dBrandingDomain_status_enum',
      'o2dBrandingAsset_status_enum',
      'o2dBrandingVersion_status_enum',
      'o2dBrandingConfiguration_status_enum',
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "core"."${enumName}"`);
    }
  }
}
