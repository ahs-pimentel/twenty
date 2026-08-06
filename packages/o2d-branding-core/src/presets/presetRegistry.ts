import odoisPresetJson from './odois.preset.json';
import twentyDefaultPresetJson from './twenty-default.preset.json';
import { type O2DBrandingPreset } from '../types/branding.types';

export const TWENTY_DEFAULT_PRESET =
  twentyDefaultPresetJson as O2DBrandingPreset;

// Provisional óDois identity (tokens only, no proprietary assets) generated
// by scripts/generateOdoisPreset.ts — pending brand approval (JUR-4).
export const ODOIS_PRESET = odoisPresetJson as O2DBrandingPreset;

const PRESET_REGISTRY: Record<string, O2DBrandingPreset> = {
  'preset.twenty-default': TWENTY_DEFAULT_PRESET,
  'preset.odois': ODOIS_PRESET,
};

export const getPreset = (name: string): O2DBrandingPreset | undefined =>
  PRESET_REGISTRY[name];
