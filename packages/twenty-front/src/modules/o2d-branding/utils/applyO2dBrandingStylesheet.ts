import { O2D_DISTRIBUTION_BRANDING } from '@/o2d-branding/constants/O2dDistributionBranding';
import { type O2dBrandingRuntimeArtifact } from '@/o2d-branding/states/o2dBrandingArtifactState';

const STYLE_ELEMENT_ID = 'o2d-branding';

const serializeBlock = (
  selector: string,
  block: Record<string, string>,
): string => {
  const declarations = Object.entries(block)
    .map(([variable, value]) => `${variable}: ${value};`)
    .join('\n  ');

  return `${selector} {\n  ${declarations}\n}`;
};

// Applies a branding artifact as a single stylesheet appended to <head>.
// `html.light`/`html.dark` outweigh the twenty-ui `.light`/`.dark` rules by
// specificity, so the whole theme changes without touching any component
// (doc 08 §2). Idempotent per artifact hash; swapping hashes replaces the
// element atomically. Defaults to the embedded distribution artifact.
export const applyO2dBrandingStylesheet = (
  targetDocument: Document,
  artifact: Pick<O2dBrandingRuntimeArtifact, 'hash' | 'css'> = {
    hash: O2D_DISTRIBUTION_BRANDING.hash,
    css: O2D_DISTRIBUTION_BRANDING.css,
  },
): void => {
  const existing = targetDocument.getElementById(STYLE_ELEMENT_ID);

  if (
    existing !== null &&
    existing.getAttribute('data-hash') === artifact.hash
  ) {
    return;
  }

  const styleElement = targetDocument.createElement('style');

  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.setAttribute('data-hash', artifact.hash);
  styleElement.textContent = [
    serializeBlock('html.light', artifact.css.light),
    serializeBlock('html.dark', artifact.css.dark),
  ].join('\n');

  if (existing !== null) {
    existing.replaceWith(styleElement);
  } else {
    targetDocument.head.appendChild(styleElement);
  }
};
