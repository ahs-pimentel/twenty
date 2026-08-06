import twentyDefaultPresetJson from './twenty-default.preset.json';
import { type O2DBrandingPreset } from '../types/branding.types';

export const TWENTY_DEFAULT_PRESET =
  twentyDefaultPresetJson as O2DBrandingPreset;

// preset.odois lands in phase 2 with the approved óDois assets (doc 24 —
// proprietary data, never committed to the AGPL core).
const PRESET_REGISTRY: Record<string, O2DBrandingPreset> = {
  'preset.twenty-default': TWENTY_DEFAULT_PRESET,
};

export const getPreset = (name: string): O2DBrandingPreset | undefined =>
  PRESET_REGISTRY[name];
