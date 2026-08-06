import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingVersionEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-version.entity';
import {
  computeO2dBrandingVersionDiff,
  type O2dBrandingVersionDiff,
} from 'src/engine/core-modules/o2d-branding/utils/compute-o2d-branding-version-diff.util';

// Serves the automatic changelog diff of doc 15 §2 on demand — snapshots
// are immutable, so the diff is derived instead of stored.
@Injectable()
export class O2dBrandingVersionDiffService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getVersionDiff(
    workspaceId: string,
    configurationId: string,
    fromNumber: number,
    toNumber: number,
  ): Promise<
    O2dBrandingVersionDiff & { fromNumber: number; toNumber: number }
  > {
    const configuration = await this.dataSource.manager.findOneBy(
      O2dBrandingConfigurationEntity,
      { id: configurationId, workspaceId },
    );

    if (configuration === null) {
      throw new NotFoundException('branding configuration not found');
    }

    const [fromVersion, toVersion] = await Promise.all([
      this.dataSource.manager.findOneBy(O2dBrandingVersionEntity, {
        configurationId: configuration.id,
        number: fromNumber,
      }),
      this.dataSource.manager.findOneBy(O2dBrandingVersionEntity, {
        configurationId: configuration.id,
        number: toNumber,
      }),
    ]);

    if (fromVersion === null || toVersion === null) {
      throw new NotFoundException(
        `version ${fromVersion === null ? fromNumber : toNumber} not found for this configuration`,
      );
    }

    return {
      fromNumber,
      toNumber,
      ...computeO2dBrandingVersionDiff(
        fromVersion.snapshot,
        toVersion.snapshot,
      ),
    };
  }
}
