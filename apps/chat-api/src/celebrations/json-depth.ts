const OPEN_OBJECT = 0x7b; // {
const OPEN_ARRAY = 0x5b; // [
const CLOSE_OBJECT = 0x7d; // }
const CLOSE_ARRAY = 0x5d; // ]
const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \
/* Fatal, so malformed UTF-8 is a rejection rather than U+FFFD in the result. */
const UTF8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Returns `true` when the JSON text nests objects and arrays deeper than
 * `maxDepth`. Brackets inside strings, escaped quotes included, are ignored.
 * The scan only rejects: well-formedness is left to `JSON.parse`.
 */
export const exceedsJsonDepth = (bytes: Uint8Array, maxDepth: number) => {
  let depth = 0;
  let isInString = false;
  let isEscaped = false;
  for (const byte of bytes) {
    if (isInString) {
      if (isEscaped) isEscaped = false;
      else if (byte === BACKSLASH) isEscaped = true;
      else if (byte === QUOTE) isInString = false;
      continue;
    }
    if (byte === QUOTE) isInString = true;
    else if (byte === OPEN_OBJECT || byte === OPEN_ARRAY) {
      depth++;
      if (depth > maxDepth) return true;
    } else if (byte === CLOSE_OBJECT || byte === CLOSE_ARRAY) depth--;
  }
  return false;
};

/**
 * Parses UTF-8 JSON after the depth check. Returns `{ error }` instead of
 * throwing, so the caller decides how a rejection is logged and reported.
 */
export const parseBoundedJson = (
  bytes: Uint8Array,
  maxDepth: number,
): { value: unknown } | { error: string } => {
  if (exceedsJsonDepth(bytes, maxDepth)) {
    return { error: `JSON nesting exceeds ${maxDepth}` };
  }
  try {
    return { value: JSON.parse(UTF8.decode(bytes)) };
  } catch {
    /* The parser message can quote the body, so it is not passed on. */
    return { error: 'invalid JSON' };
  }
};
