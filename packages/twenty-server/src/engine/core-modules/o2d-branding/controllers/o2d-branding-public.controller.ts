import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';

import { type Request, type Response } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { O2dBrandingDistributionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';
import { O2dBrandingResolutionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-resolution.service';

// Public runtime endpoint (doc 19): resolves the published branding for the
// requesting origin. Aggressively cacheable (ETag = artifact hash); on any
// internal failure it degrades to the distribution artifact with the
// X-O2d-Branding-Fallback marker — never an empty error body.
@Controller('/branding')
export class O2dBrandingPublicController {
  constructor(
    private readonly resolutionService: O2dBrandingResolutionService,
    private readonly distributionService: O2dBrandingDistributionService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
  ) {}

  @Get('current')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getCurrentBranding(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    let artifact = this.distributionService.getDistributionArtifact();
    let fallback = true;

    try {
      const origin =
        request.headers.origin ??
        (request.headers.host !== undefined
          ? `https://${request.headers.host}`
          : undefined);

      if (origin !== undefined) {
        const workspace =
          await this.workspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace(
            origin,
          );

        if (workspace !== null && workspace !== undefined) {
          artifact = await this.resolutionService.resolveByWorkspace(
            workspace.id,
          );
          fallback = false;
        }
      }
    } catch {
      fallback = true;
      artifact = this.distributionService.getDistributionArtifact();
    }

    response.setHeader('ETag', artifact.hash);
    response.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=600',
    );

    if (fallback) {
      response.setHeader('X-O2d-Branding-Fallback', '1');
    }

    if (request.headers['if-none-match'] === artifact.hash) {
      response.status(304);

      return;
    }

    return {
      hash: artifact.hash,
      tokens: { cssLight: artifact.cssLight, cssDark: artifact.cssDark },
      assets: {},
      brand: artifact.brand,
      meta: artifact.meta,
    };
  }
}
