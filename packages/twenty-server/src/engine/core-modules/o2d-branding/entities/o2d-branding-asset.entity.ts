import { registerEnumType } from '@nestjs/graphql';

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
export class O2dBrandingAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  configurationId: string;

  @ManyToOne(() => O2dBrandingConfigurationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'configurationId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_ASSET_CONFIGURATION',
  })
  configuration: Relation<O2dBrandingConfigurationEntity>;

  @Column({ type: 'varchar' })
  type: O2DAssetSlot;

  @Column()
  name: string;

  @Column()
  format: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'int', nullable: true })
  width?: number | null;

  @Column({ type: 'int', nullable: true })
  height?: number | null;

  @Column()
  hash: string;

  @Column()
  storageKey: string;

  @Column({ type: 'varchar', nullable: true })
  url?: string | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingAssetStatus),
    default: O2dBrandingAssetStatus.PROCESSING,
  })
  status: O2dBrandingAssetStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
