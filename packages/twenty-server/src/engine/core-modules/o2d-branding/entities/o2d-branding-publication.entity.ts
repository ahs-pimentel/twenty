import { registerEnumType } from '@nestjs/graphql';

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import {
  O2dBrandingPublicationEnvironment,
  O2dBrandingPublicationStatus,
} from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';

registerEnumType(O2dBrandingPublicationEnvironment, {
  name: 'O2dBrandingPublicationEnvironment',
});
registerEnumType(O2dBrandingPublicationStatus, {
  name: 'O2dBrandingPublicationStatus',
});

// Publication attempts log (doc 18 §o2dBrandingPublication).
@Entity({ name: 'o2dBrandingPublication', schema: 'core' })
@Index('IDX_O2D_BRANDING_PUBLICATION_CONFIGURATION_PUBLISHED_AT', [
  'configurationId',
  'publishedAt',
])
export class O2dBrandingPublicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  configurationId: string;

  @ManyToOne(() => O2dBrandingConfigurationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'configurationId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_PUBLICATION_CONFIGURATION',
  })
  configuration: Relation<O2dBrandingConfigurationEntity>;

  @Column({ nullable: false, type: 'uuid' })
  versionId: string;

  @ManyToOne(() => O2dBrandingVersionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'versionId',
    foreignKeyConstraintName: 'FK_O2D_BRANDING_PUBLICATION_VERSION',
  })
  version: Relation<O2dBrandingVersionEntity>;

  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingPublicationEnvironment),
    default: O2dBrandingPublicationEnvironment.PRODUCTION,
  })
  environment: O2dBrandingPublicationEnvironment;

  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingPublicationStatus),
  })
  status: O2dBrandingPublicationStatus;

  @Column({ type: 'uuid', nullable: true })
  publishedBy?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  publishedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  validationResult?: object | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;
}
