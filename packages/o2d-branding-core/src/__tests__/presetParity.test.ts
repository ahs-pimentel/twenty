import { readInstalledThemeCss } from './testHelpers';
import { buildTwentyDefaultPreset } from '../../scripts/generateTwentyDefaultPreset';
import { TWENTY_DEFAULT_PRESET } from '../presets/presetRegistry';

// The committed preset is generated, never hand-maintained (doc 06 §5).
// When this test fails after an upstream sync, re-run
// scripts/generateTwentyDefaultPreset.ts — that is the manual precursor of
// the upstream bridge regeneration (doc 21).
describe('preset.twenty-default parity with installed theme CSS', () => {
  it('matches a fresh extraction from theme-light.css/theme-dark.css', () => {
    const { lightCssText, darkCssText } = readInstalledThemeCss();

    expect(TWENTY_DEFAULT_PRESET).toEqual(
      buildTwentyDefaultPreset(lightCssText, darkCssText),
    );
  });

  it('pins the upstream base commit it was extracted from', () => {
    expect(TWENTY_DEFAULT_PRESET.sourceCommit).toBe(
      '538b180824dc4c3bbd3b9cb70662a01a69a64ae1',
    );
  });
});
