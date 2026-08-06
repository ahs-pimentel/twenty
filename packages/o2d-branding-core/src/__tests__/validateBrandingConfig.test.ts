import { buildDefaultConfig } from './testHelpers';
import { validateBrandingConfig } from '../validate/validateBrandingConfig';

const rulesOf = (result: { issues: Array<{ rule: string }> }) =>
  result.issues.map((issue) => issue.rule);

describe('validateBrandingConfig', () => {
  it('accepts the untouched default preset (baseline never blocks)', () => {
    const result = validateBrandingConfig(buildDefaultConfig());

    expect(
      result.issues.filter((issue) => issue.severity === 'error'),
    ).toEqual([]);
    expect(result.status).toBe('valid');
  });

  it('accepts a well-formed brand color change', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({ tokens: { 'brand.primary': '#16a34a' } }),
    );

    expect(
      result.issues.filter((issue) => issue.severity === 'error'),
    ).toEqual([]);
  });

  it('rejects structurally invalid configs via the schema', () => {
    const invalid = buildDefaultConfig();

    // Unknown token paths are a schema violation, not a soft warning.
    (invalid.tokens as Record<string, string>)['nope.token'] = '#ffffff';

    const result = validateBrandingConfig(invalid);

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('schema');
  });

  it('rejects direct writes to calculated and read-only tokens', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({
        tokens: { 'brand.scale.5': '#ffffff', 'spacing.unit': 8 },
      }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('tier.calculated');
    expect(rulesOf(result)).toContain('tier.readonly');
  });

  it('rejects CSS injection attempts in token values', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({
        tokens: { 'text.primary': '#fff; background: url(https://x)' },
      }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('css.injection');
  });

  it('rejects unparsable colors', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({ tokens: { 'text.primary': 'not-a-color' } }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('color.format');
  });

  it('rejects dimensions outside catalog bounds instead of clamping (A4)', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({ tokens: { 'font.size.xs': '0.5rem' } }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('dimension.bounds');
  });

  it('blocks customizations that break contrast invariants (A2)', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({
        tokens: {
          'brand.primary': '#ffff00',
          'brand.onPrimary': '#ffffff',
        },
      }),
    );

    expect(result.status).toBe('failed');
    expect(
      rulesOf(result).some(
        (rule) =>
          rule === 'contrast.a2' || rule.startsWith('brandScale.'),
      ),
    ).toBe(true);
  });

  it('blocks text colors without contrast on custom backgrounds (A1)', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({
        tokens: {
          'text.primary': { light: '#cccccc', dark: '#333333' },
        },
      }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('contrast.a1');
  });

  it('blocks status colors that collapse into each other (A7)', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({
        tokens: {
          'status.success': '#c0392b',
          'status.error': '#c0392c',
        },
      }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('status.a7');
  });

  it('reports an unknown preset as a validation failure', () => {
    const result = validateBrandingConfig(
      buildDefaultConfig({ basePreset: 'preset.missing' }),
    );

    expect(result.status).toBe('failed');
    expect(rulesOf(result)).toContain('preset.unknown');
  });
});
