import { buildDefaultConfig } from './testHelpers';
import { normalizeBrandingConfig } from '../normalize/normalizeBrandingConfig';

describe('normalizeBrandingConfig', () => {
  it('is deterministic: same input yields the same resolved output and hash', () => {
    const first = normalizeBrandingConfig(buildDefaultConfig());
    const second = normalizeBrandingConfig(buildDefaultConfig());

    expect(first.resolved).not.toBeNull();
    expect(first.resolved).toEqual(second.resolved);
    expect(first.resolved?.meta.hash).toBe(second.resolved?.meta.hash);
  });

  it('produces a dense map covering the preset for both modes (golden)', () => {
    const { resolved, issues } = normalizeBrandingConfig(buildDefaultConfig());

    expect(issues).toEqual([]);
    expect(resolved).not.toBeNull();
    expect(Object.keys(resolved!.tokens.light).length).toBeGreaterThanOrEqual(
      50,
    );
    expect(resolved!.tokens.light['brand.primary']).toBe(
      'color(display-p3 0.276 0.384 0.837)',
    );
    // Golden snapshot: any change to normalization output is a deliberate,
    // reviewed change (stable hash is a phase 1 acceptance criterion).
    expect(resolved).toMatchSnapshot();
  });

  it('keeps the preset scale untouched when brand.primary equals the baseline', () => {
    const { resolved } = normalizeBrandingConfig(buildDefaultConfig());

    expect(resolved!.tokens.light['brand.scale.9']).toBe(
      'color(display-p3 0.276 0.384 0.837)',
    );
  });

  it('regenerates the scale and derived tokens when brand.primary changes', () => {
    const { resolved, issues } = normalizeBrandingConfig(
      buildDefaultConfig({ tokens: { 'brand.primary': '#16a34a' } }),
    );

    expect(issues).toEqual([]);
    expect(resolved!.tokens.light['brand.scale.9']).toBe('#16a34a');
    expect(resolved!.tokens.dark['brand.scale.9']).toBe('#16a34a');
    expect(resolved!.tokens.light['border.focus']).toBe(
      resolved!.tokens.light['brand.scale.7'],
    );
    expect(resolved!.tokens.light['brand.primaryHover']).toBe(
      resolved!.tokens.light['brand.scale.10'],
    );
    expect(resolved!.tokens.light['brand.primaryActive']).toBe(
      resolved!.tokens.light['brand.scale.11'],
    );
  });

  it('re-derives surfaces from overridden backgrounds unless surfaces are set', () => {
    const { resolved } = normalizeBrandingConfig(
      buildDefaultConfig({
        tokens: { 'background.secondary': '#f2f0ea' },
      }),
    );

    expect(resolved!.tokens.light['surface.primary']).toBe('#f2f0ea');

    const explicit = normalizeBrandingConfig(
      buildDefaultConfig({
        tokens: {
          'background.secondary': '#f2f0ea',
          'surface.primary': '#ffffff',
        },
      }),
    );

    expect(explicit.resolved!.tokens.light['surface.primary']).toBe('#ffffff');
  });

  it('expands per-mode overrides and hashes the assets and brand block', () => {
    const withModes = normalizeBrandingConfig(
      buildDefaultConfig({
        tokens: {
          'background.primary': { light: '#ffffff', dark: '#101014' },
        },
      }),
    );

    expect(withModes.resolved!.tokens.light['background.primary']).toBe(
      '#ffffff',
    );
    expect(withModes.resolved!.tokens.dark['background.primary']).toBe(
      '#101014',
    );

    const differentBrand = normalizeBrandingConfig(
      buildDefaultConfig({
        brand: { productName: 'Acme CRM', shortName: 'Acme' },
      }),
    );

    expect(differentBrand.resolved!.meta.hash).not.toBe(
      normalizeBrandingConfig(buildDefaultConfig()).resolved!.meta.hash,
    );
  });

  it('fails softly on an unknown preset', () => {
    const { resolved, issues } = normalizeBrandingConfig(
      buildDefaultConfig({ basePreset: 'preset.nope' }),
    );

    expect(resolved).toBeNull();
    expect(issues[0].rule).toBe('preset.unknown');
  });
});
