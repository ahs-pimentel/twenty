import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import {
  type O2DBrandingConfig,
  type O2DResolvedBranding,
  type ResolvedAssetMap,
  type ValidationIssue,
} from 'o2d-branding-core';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';

registerEnumType(O2dBrandingVersionStatus, {
  name: 'O2dBrandingVersionStatus',
});

export type O2dBrandingVersionArtifact = {
  cssLight: Record<string, string>;
  cssDark: Record<string, string>;
  meta: { adapterVersion: string; hash: string };
};

export type O2dBrandingTwentyVersion = {
  baseCommit: string;
  appVersion?: string;
};

// Immutable version snapshot (docs 15/18). Snapshots of statuses >=
// PUBLISHED are never updated — enforced at the service layer.
// NOTE: doc 18 marks `hash` as globally UNIQUE, but doc 15 mandates that a
// rollback creates a NEW version whose snapshot (and therefore hash) equals
// the restored one — the two rules are incompatible, so `hash` is indexed,
// not unique (deviation recorded in the PR).
@Entity({ name: 'o2dBrandingVersion', schema: 'core' })
@Index('IDX_O2D_BRANDING_VERSION_HASH', ['hash'])
@Unique('UQ_O2D_BRANDING_VERSION_CONFIGURATION_NUMBER', [
  'configurationId',
  'number',
])
@ObjectType('O2dBrandingVersion')
export class O2dBrandingVersionEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  configurationId: string;

  @ManyToOne(() => O2dBrandingConfigurationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'configurationId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_VERSION_CONFIGURATION',
  })
  configuration: Relation<O2dBrandingConfigurationEntity>;

  @Field(() => Int)
  @Column({ type: 'int' })
  number: number;

  @Field(() => O2dBrandingVersionStatus)
  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingVersionStatus),
    default: O2dBrandingVersionStatus.DRAFT,
  })
  status: O2dBrandingVersionStatus;

  @Field(() => GraphQLJSON)
  @Column({ type: 'jsonb' })
  snapshot: O2DResolvedBranding;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  assetManifest: ResolvedAssetMap;

  // Exact source config that produced the snapshot (doc 15 §4) — lets an
  // old-adapter version be restored as an editable draft. Nullable for
  // versions published before phase 4.
  @Column({ type: 'jsonb', nullable: true })
  sourceConfig?: O2DBrandingConfig | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  artifact?: O2dBrandingVersionArtifact | null;

  @Field()
  @Column()
  schemaVersion: string;

  @Field()
  @Column()
  adapterVersion: string;

  @Column({ type: 'jsonb' })
  twentyVersion: O2dBrandingTwentyVersion;

  @Field()
  @Column()
  hash: string;

  @Field(() => UUIDScalarType, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  basedOnVersionId?: string | null;

  @ManyToOne(() => O2dBrandingVersionEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'basedOnVersionId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_VERSION_BASED_ON',
  })
  basedOnVersion?: Relation<O2dBrandingVersionEntity> | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  changelog?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  validationResult?: {
    status: 'valid' | 'failed';
    issues: ValidationIssue[];
  } | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
