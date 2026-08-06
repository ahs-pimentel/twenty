import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { type O2DAssetSlot } from 'o2d-branding-core';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingAssetStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';

registerEnumType(O2dBrandingAssetStatus, { name: 'O2dBrandingAssetStatus' });

// Asset metadata (doc 18 §o2dBrandingAsset). Binaries live in FileStorage;
// the ingestion/sanitization pipeline (doc 11) lands in a follow-up
// increment — the table is created now so the o2d-branding-init migration
// matches the full data model.
@Entity({ name: 'o2dBrandingAsset', schema: 'core' })
@Unique('UQ_O2D_BRANDING_ASSET_CONFIG_TYPE_HASH', [
  'configurationId',
  'type',
  'hash',
])
@ObjectType('O2dBrandingAsset')
export class O2dBrandingAssetEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => UUIDScalarType)
  @Column({ nullable: false, type: 'uuid' })
  configurationId: string;

  @ManyToOne(() => O2dBrandingConfigurationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'configurationId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_ASSET_CONFIGURATION',
  })
  configuration: Relation<O2dBrandingConfigurationEntity>;

  @Field(() => String)
  @Column({ type: 'varchar' })
  type: O2DAssetSlot;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  format: string;

  @Field(() => Int)
  @Column({ type: 'int' })
  sizeBytes: number;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  width?: number | null;

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  height?: number | null;

  @Field()
  @Column()
  hash: string;

  @Column()
  storageKey: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  url?: string | null;

  @Field(() => Int)
  @Column({ type: 'int', default: 1 })
  version: number;

  @Field(() => O2dBrandingAssetStatus)
  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingAssetStatus),
    default: O2dBrandingAssetStatus.PROCESSING,
  })
  status: O2dBrandingAssetStatus;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
