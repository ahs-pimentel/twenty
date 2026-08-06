import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

export type O2dBrandingSvgSanitizationResult =
  | { accepted: true; sanitized: string }
  | { accepted: false; reason: string };

// Detects url(...) / href values that point outside the document. Fragment
// references (#id) and data: images are the only tolerated URI forms.
const EXTERNAL_REFERENCE_PATTERN =
  /url\s*\(\s*['"]?\s*(?!#|data:)[^)'"\s]|(?:xlink:href|href)\s*=\s*['"](?!#|data:)/i;

// Doc 11 §3: branding SVGs pass an allowlist sanitizer, and anything the
// sanitizer would have to strip is grounds for rejection (allowlist, not
// silent repair) — a legitimate logo has no reason to carry scripts,
// foreignObject, event handlers, DOCTYPE or external references.
export const sanitizeO2dBrandingSvg = (
  source: string,
): O2dBrandingSvgSanitizationResult => {
  if (/<!DOCTYPE/i.test(source) || /<!ENTITY/i.test(source)) {
    return {
      accepted: false,
      reason: 'svg contains a DOCTYPE or entity declaration',
    };
  }

  const window = new JSDOM('').window;
  const purify = DOMPurify(window);

  const sanitized = purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['foreignObject', 'script', 'style', 'animate', 'set'],
    FORBID_ATTR: ['style'],
  });

  // DOMPurify parses the fragment into a synthetic <body> wrapper and then
  // strips it (body is outside the svg profile) — exactly one BODY removal
  // is that wrapper. Anything else stripped means the input was outside the
  // allowlist and the file is rejected rather than silently repaired.
  const wrapperBodyRemovals = purify.removed.filter(
    (entry) =>
      'element' in entry &&
      (entry.element as Element | null)?.tagName === 'BODY',
  );

  if (purify.removed.length - wrapperBodyRemovals.length > 0 || wrapperBodyRemovals.length > 1) {
    return {
      accepted: false,
      reason: 'svg contains disallowed elements or attributes',
    };
  }

  if (!/<svg[\s>]/i.test(sanitized)) {
    return { accepted: false, reason: 'file is not a valid svg document' };
  }

  if (EXTERNAL_REFERENCE_PATTERN.test(sanitized)) {
    return { accepted: false, reason: 'svg references an external resource' };
  }

  return { accepted: true, sanitized };
};
