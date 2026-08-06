// Parses a Twenty theme stylesheet (theme-light.css / theme-dark.css) into a
// map of custom properties. Pure text-in/map-out — callers own file IO.
export const parseThemeCssVariables = (
  cssText: string,
): Record<string, string> => {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const variables: Record<string, string> = {};
  const declarationPattern = /(--t-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;

  let match = declarationPattern.exec(withoutComments);

  while (match !== null) {
    // Multi-line values (box shadows) collapse to single-spaced strings so
    // comparisons are whitespace-insensitive.
    variables[match[1]] = match[2].replace(/\s+/g, ' ').trim();
    match = declarationPattern.exec(withoutComments);
  }

  return variables;
};
