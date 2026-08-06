import { O2D_DISTRIBUTION_BRANDING } from '@/o2d-branding/constants/O2dDistributionBranding';
import { applyO2dBrandingStylesheet } from '@/o2d-branding/utils/applyO2dBrandingStylesheet';

describe('applyO2dBrandingStylesheet', () => {
  afterEach(() => {
    document.getElementById('o2d-branding')?.remove();
  });

  it('appends a single stylesheet with both mode blocks and the artifact hash', () => {
    applyO2dBrandingStylesheet(document);

    const styleElement = document.getElementById('o2d-branding');

    expect(styleElement).not.toBeNull();
    expect(styleElement?.getAttribute('data-hash')).toBe(
      O2D_DISTRIBUTION_BRANDING.hash,
    );
    expect(styleElement?.textContent).toContain('html.light {');
    expect(styleElement?.textContent).toContain('html.dark {');
    expect(styleElement?.textContent).toContain(
      `--t-color-blue: ${O2D_DISTRIBUTION_BRANDING.css.light['--t-color-blue']};`,
    );
  });

  it('is idempotent for the same artifact hash', () => {
    applyO2dBrandingStylesheet(document);
    applyO2dBrandingStylesheet(document);

    expect(document.querySelectorAll('#o2d-branding')).toHaveLength(1);
  });

  it('swaps atomically to a published artifact with a different hash', () => {
    applyO2dBrandingStylesheet(document);
    applyO2dBrandingStylesheet(document, {
      hash: 'published-hash',
      css: {
        light: { '--t-color-blue': 'mock-light-value' },
        dark: { '--t-color-blue': 'mock-dark-value' },
      },
    });

    const styleElements = document.querySelectorAll('#o2d-branding');

    expect(styleElements).toHaveLength(1);
    expect(styleElements[0].getAttribute('data-hash')).toBe('published-hash');
    expect(styleElements[0].textContent).toContain(
      '--t-color-blue: mock-light-value;',
    );
  });

  it('replaces a stale stylesheet from another hash', () => {
    const staleElement = document.createElement('style');

    staleElement.id = 'o2d-branding';
    staleElement.setAttribute('data-hash', 'stale');
    document.head.appendChild(staleElement);

    applyO2dBrandingStylesheet(document);

    const styleElements = document.querySelectorAll('#o2d-branding');

    expect(styleElements).toHaveLength(1);
    expect(styleElements[0].getAttribute('data-hash')).toBe(
      O2D_DISTRIBUTION_BRANDING.hash,
    );
  });
});
