import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';

import { type Request, type Response } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { O2dBrandingAssetService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-asset.service';
import { O2dBrandingDistributionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';
import { O2dBrandingResolutionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-resolution.service';

// Filename segment of an asset URL: {sha256-hex}.{format}. Anything else
// is a 404 before touching the database.
const ASSET_FILE_PATTERN = /^([a-f0-9]{64})\.(svg|png|webp|ico)$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    private readonly assetService: O2dBrandingAssetService,
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
      assets: artifact.assets,
      brand: artifact.brand,
      meta: artifact.meta,
    };
  }

  // Content-addressed asset serving (doc 11 §4): the id+hash pair is the
  // whole access key, the content behind it never changes, so the response
  // is immutable-cacheable for a year. Every failure mode is a plain 404.
  @Get('asset/:assetId/:file')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getBrandingAsset(
    @Param('assetId') assetId: string,
    @Param('file') file: string,
    @Res() response: Response,
  ) {
    const fileMatch = ASSET_FILE_PATTERN.exec(file);

    if (fileMatch === null || !UUID_PATTERN.test(assetId)) {
      response.status(404).send();

      return;
    }

    try {
      const content = await this.assetService.getAssetContent(
        assetId,
        fileMatch[1],
        fileMatch[2],
      );

      if (content === null) {
        response.status(404).send();

        return;
      }

      response.setHeader('Content-Type', content.contentType);
      response.setHeader('Content-Length', content.sizeBytes);
      response.setHeader(
        'Cache-Control',
        'public, max-age=31536000, immutable',
      );
      response.setHeader('ETag', fileMatch[1]);
      content.stream.pipe(response);
    } catch {
      response.status(404).send();
    }
  }
}
