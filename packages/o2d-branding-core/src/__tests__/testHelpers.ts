import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseThemeCssVariables } from '../css/parseThemeCssVariables';
import { type O2DBrandingConfig } from '../types/branding.types';

const THEME_CSS_DIRECTORY = join(
  __dirname,
  '../../../twenty-ui/src/theme-constants',
);

export const readInstalledThemeCss = () => {
  const lightCssText = readFileSync(
    join(THEME_CSS_DIRECTORY, 'theme-light.css'),
    'utf-8',
  );
  const darkCssText = readFileSync(
    join(THEME_CSS_DIRECTORY, 'theme-dark.css'),
    'utf-8',
  );

  return {
    lightCssText,
    darkCssText,
    light: parseThemeCssVariables(lightCssText),
    dark: parseThemeCssVariables(darkCssText),
  };
};

export const buildDefaultConfig = (
  overrides: Partial<O2DBrandingConfig> = {},
): O2DBrandingConfig => ({
  schemaVersion: 'o2d.branding.config/1-0-0',
  basePreset: 'preset.twenty-default',
  brand: { productName: 'Twenty', shortName: 'Twenty' },
  tokens: {},
  assets: {},
  ...overrides,
});
