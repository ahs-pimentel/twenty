import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalHash, canonicalStringify } from '../normalize/canonicalHash';
import { parseThemeCssVariables } from '../css/parseThemeCssVariables';
import { brandingConfigJsonSchema } from '../schemas/brandingConfigSchema';
import { TOKEN_CATALOG, TOKEN_CATALOG_VERSION } from '../tokens/tokenCatalog';

describe('canonical hash', () => {
  it('ignores key order and undefined members', () => {
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(canonicalStringify({ a: 1, skip: undefined })).toBe(
      canonicalStringify({ a: 1 }),
    );
  });

  it('produces the frozen golden digest for a known payload', () => {
    // Golden value: changing serialization or hashing invalidates every
    // stored snapshot hash — that must be an explicit, reviewed decision.
    expect(canonicalHash({ hello: 'world', list: [1, 2, 3] })).toBe(
      canonicalHash({ list: [1, 2, 3], hello: 'world' }),
    );
    expect(canonicalHash({ hello: 'world' })).toMatchSnapshot();
  });
});

describe('theme CSS parser', () => {
  it('handles single-line, multi-line and commented declarations', () => {
    const parsed = parseThemeCssVariables(`
      /* comment with --t-fake-var: nope; */
      .light {
        --t-simple: 4px;
        --t-multi:
          0px 2px 4px 0px color(display-p3 0 0 0 / 0.039),
          0px 0px 4px 0px color(display-p3 0 0 0 / 0.078);
      }
    `);

    expect(parsed['--t-simple']).toBe('4px');
    expect(parsed['--t-multi']).toBe(
      '0px 2px 4px 0px color(display-p3 0 0 0 / 0.039), 0px 0px 4px 0px color(display-p3 0 0 0 / 0.078)',
    );
    expect(parsed['--t-fake-var']).toBeUndefined();
  });
});

describe('token catalog v1 freeze', () => {
  it('never changes without a schema version bump', () => {
    expect(TOKEN_CATALOG_VERSION).toBe('o2d.branding.tokens/1-0-0');
    expect(TOKEN_CATALOG).toMatchSnapshot();
  });
});

describe('JSON Schema artifact', () => {
  it('stays in sync with the zod source of truth', () => {
    const committed = JSON.parse(
      readFileSync(
        join(__dirname, '../../schemas/o2d.branding.config-1-0-0.schema.json'),
        'utf-8',
      ),
    );

    expect(committed).toEqual(brandingConfigJsonSchema());
  });
});
