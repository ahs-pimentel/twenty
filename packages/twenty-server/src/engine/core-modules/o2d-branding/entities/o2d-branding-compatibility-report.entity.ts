import { registerEnumType } from '@nestjs/graphql';

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { O2dBrandingCompatibilityStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';

registerEnumType(O2dBrandingCompatibilityStatus, {
  name: 'O2dBrandingCompatibilityStatus',
});

// Adapter compatibility reports written by the upstream bridge CI
// (doc 18 §o2dBrandingCompatibilityReport; consumed from phase 6 on).
@Entity({ name: 'o2dBrandingCompatibilityReport', schema: 'core' })
export class O2dBrandingCompatibilityReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  twentyVersion: { baseCommit: string; appVersion?: string };

  @Column()
  adapterVersion: string;

  @Column({
    type: 'enum',
    enum: Object.values(O2dBrandingCompatibilityStatus),
  })
  status: O2dBrandingCompatibilityStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  conflicts: object[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  warnings: object[];

  @Column({ type: 'jsonb', nullable: true })
  testsSummary?: object | null;

  @CreateDateColumn({ type: 'timestamptz' })
  generatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  syncRunId?: string | null;
}
