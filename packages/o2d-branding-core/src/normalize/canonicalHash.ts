import { createHash } from 'node:crypto';

// Canonical serialization: object keys sorted recursively so the same
// logical value always yields the same bytes — the hash is part of the
// version snapshot and cache keys (doc 06 §3).
export const canonicalStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([keyA], [keyB]) => (keyA < keyB ? -1 : 1))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`,
    );

  return `{${entries.join(',')}}`;
};

export const canonicalHash = (value: unknown): string =>
  createHash('sha256').update(canonicalStringify(value)).digest('hex');
