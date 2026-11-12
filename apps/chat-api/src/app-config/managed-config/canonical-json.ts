import { createHash } from 'node:crypto';

const canonicalize = (value: unknown): string | undefined => {
  if (value === null || typeof value !== 'object') {
    /* Primitives exactly as JSON.stringify writes them; `undefined` and
     * functions have no JSON form and are skipped like JSON.stringify does. */
    return JSON.stringify(value) as string | undefined;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item) ?? 'null').join(',')}]`;
  }
  const members = Object.keys(value)
    .sort()
    .flatMap((key) => {
      const member = canonicalize((value as Record<string, unknown>)[key]);
      return member === undefined ? [] : [`${JSON.stringify(key)}:${member}`];
    });
  return `{${members.join(',')}}`;
};

/**
 * Config Studio's canonical JSON: object keys sorted at every level in
 * ascending UTF-16 code-unit order (JavaScript's default sort), primitives
 * serialized as by `JSON.stringify`, and no whitespace. Studio's schema size
 * limit and `sha256` are both computed over these bytes.
 */
export const canonicalJson = (value: unknown): string => {
  const serialized = canonicalize(value);
  if (serialized === undefined) {
    throw new TypeError('The value has no JSON representation');
  }
  return serialized;
};

/** The UTF-8 byte length of `canonicalJson(value)`. */
export const canonicalByteLength = (value: unknown): number =>
  Buffer.byteLength(canonicalJson(value), 'utf8');

/** Lowercase hex SHA-256 of the UTF-8 bytes of `canonicalJson(value)`. */
export const canonicalSha256 = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
