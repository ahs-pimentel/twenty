import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import { O2dBrandingConfigurationEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-configuration.entity';
import { O2dBrandingDomainEntity } from 'src/engine/core-modules/o2d-branding/entities/o2d-branding-domain.entity';
import { O2dBrandingDomainStatus } from 'src/engine/core-modules/o2d-branding/enums/o2d-branding.enums';
import { O2dBrandingAuditService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-audit.service';
import { O2dBrandingCacheService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-cache.service';

// RFC-1123-ish: labels of alphanumerics/hyphens joined by dots, at least
// one dot (a bare label cannot be a public branding host).
const HOSTNAME_PATTERN =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Admin surface for BrandingDomain rows (doc 12 §6): host → configuration
// mapping with global hostname uniqueness. DNS/TLS verification stays with
// the existing custom-domain infrastructure (Enterprise-licensed, doc 24
// §5) — rows created here are ACTIVE immediately and only affect which
// branding the public endpoint serves, never routing (JUR-2 noted in PR).
@Injectable()
export class O2dBrandingDomainService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: O2dBrandingAuditService,
    private readonly cacheService: O2dBrandingCacheService,
  ) {}

  async listForWorkspace(
    workspaceId: string,
  ): Promise<O2dBrandingDomainEntity[]> {
    return this.dataSource.manager.find(O2dBrandingDomainEntity, {
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async upsert(
    workspaceId: string,
    userId: string | undefined,
    input: { hostname: string; configurationId?: string | null },
  ): Promise<O2dBrandingDomainEntity> {
    const hostname = input.hostname.trim().toLowerCase();

    if (!HOSTNAME_PATTERN.test(hostname)) {
      throw new BadRequestException(`"${input.hostname}" is not a hostname`);
    }

    if (input.configurationId !== null && input.configurationId !== undefined) {
      const configuration = await this.dataSource.manager.findOneBy(
        O2dBrandingConfigurationEntity,
        { id: input.configurationId, workspaceId },
      );

      if (configuration === null) {
        throw new NotFoundException('branding configuration not found');
      }
    }

    const saved = await this.dataSource.transaction(async (entityManager) => {
      const existing = await entityManager.findOneBy(O2dBrandingDomainEntity, {
        hostname,
      });

      // Hostname uniqueness is global (doc 12 §6) — existence in another
      // workspace surfaces as a plain conflict, without naming its owner.
      if (existing !== null && existing.workspaceId !== workspaceId) {
        throw new ConflictException(
          `"${hostname}" is already claimed by another workspace`,
        );
      }

      const domain = await entityManager.save(O2dBrandingDomainEntity, {
        ...(existing !== null ? { id: existing.id } : {}),
        workspaceId,
        hostname,
        configurationId: input.configurationId ?? null,
        status: O2dBrandingDomainStatus.ACTIVE,
      });

      await this.auditService.record(entityManager, {
        eventType: 'branding.domain.upserted',
        workspaceId,
        configurationId: input.configurationId ?? undefined,
        actorType: 'user',
        actorId: userId,
        payload: { hostname },
      });

      return domain;
    });

    await this.cacheService.invalidateHostArtifact(hostname);

    return saved;
  }

  async remove(
    workspaceId: string,
    userId: string | undefined,
    hostname: string,
  ): Promise<boolean> {
    const normalizedHostname = hostname.trim().toLowerCase();

    await this.dataSource.transaction(async (entityManager) => {
      const domain = await entityManager.findOneBy(O2dBrandingDomainEntity, {
        hostname: normalizedHostname,
        workspaceId,
      });

      if (domain === null) {
        throw new NotFoundException('branding domain not found');
      }

      await entityManager.delete(O2dBrandingDomainEntity, { id: domain.id });

      await this.auditService.record(entityManager, {
        eventType: 'branding.domain.removed',
        workspaceId,
        actorType: 'user',
        actorId: userId,
        payload: { hostname: normalizedHostname },
      });
    });

    await this.cacheService.invalidateHostArtifact(normalizedHostname);

    return true;
  }
}
