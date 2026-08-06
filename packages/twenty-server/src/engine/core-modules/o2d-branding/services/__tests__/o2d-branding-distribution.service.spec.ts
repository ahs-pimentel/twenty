import { O2dBrandingDistributionService } from 'src/engine/core-modules/o2d-branding/services/o2d-branding-distribution.service';

describe('O2dBrandingDistributionService', () => {
  it('serves a deterministic óDois artifact with both mode blocks', () => {
    const service = new O2dBrandingDistributionService();

    const first = service.getDistributionArtifact();
    const second = service.getDistributionArtifact();

    expect(first).toBe(second);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(first.cssLight).length).toBeGreaterThan(60);
    expect(Object.keys(first.cssDark).length).toBeGreaterThan(60);
    expect(first.brand.productName).toBe('óDois CRM');
    expect(first.meta.source).toBe('distribution');
  });

  it('anchors the brand color on the solid accent step', () => {
    const artifact =
      new O2dBrandingDistributionService().getDistributionArtifact();

    expect(artifact.cssLight['--t-accent-accent9']).toBe('#7c3aed');
    expect(artifact.cssDark['--t-color-blue9']).toBe('#7c3aed');
  });
});
