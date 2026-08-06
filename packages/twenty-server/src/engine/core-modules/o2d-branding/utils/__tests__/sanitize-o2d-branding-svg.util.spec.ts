import { sanitizeO2dBrandingSvg } from 'src/engine/core-modules/o2d-branding/utils/sanitize-o2d-branding-svg.util';

const CLEAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="#7c3aed"/><circle cx="12" cy="12" r="6"/></svg>';

describe('sanitizeO2dBrandingSvg', () => {
  it('accepts a clean vector logo unchanged in meaning', () => {
    const result = sanitizeO2dBrandingSvg(CLEAN_SVG);

    expect(result.accepted).toBe(true);

    if (result.accepted) {
      expect(result.sanitized).toContain('<path');
      expect(result.sanitized).toContain('#7c3aed');
    }
  });

  it.each([
    [
      'script element',
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
    ],
    [
      'event handler attribute',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)"/></svg>',
    ],
    [
      'foreignObject element',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body>x</body></foreignObject></svg>',
    ],
    [
      'javascript href',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    ],
    [
      'inline style element',
      '<svg xmlns="http://www.w3.org/2000/svg"><style>rect{fill:url(http://evil)}</style><rect/></svg>',
    ],
  ])('rejects an svg with a %s', (_label, maliciousSvg) => {
    const result = sanitizeO2dBrandingSvg(maliciousSvg);

    expect(result.accepted).toBe(false);
  });

  it('rejects external references that survive sanitization', () => {
    const result = sanitizeO2dBrandingSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/sprite.svg#icon"/></svg>',
    );

    expect(result.accepted).toBe(false);
  });

  it('rejects DOCTYPE and entity declarations outright', () => {
    const result = sanitizeO2dBrandingSvg(
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    );

    expect(result.accepted).toBe(false);
  });

  it('keeps fragment references to gradients inside the document', () => {
    const result = sanitizeO2dBrandingSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#7c3aed"/></linearGradient></defs><rect fill="url(#g)"/></svg>',
    );

    expect(result.accepted).toBe(true);
  });

  it('rejects content that is not an svg document at all', () => {
    expect(sanitizeO2dBrandingSvg('<html><body>hi</body></html>').accepted).toBe(
      false,
    );
    expect(sanitizeO2dBrandingSvg('plain text').accepted).toBe(false);
  });
});
