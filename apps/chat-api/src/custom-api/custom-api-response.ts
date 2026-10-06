/**
 * Domain-agnostic bounded JSON transport helpers shared by CustomApiService.
 * See openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md §5.
 */

/** Maximum JSON container (object/array) nesting depth, checked before parsing. */
export const CUSTOM_API_JSON_MAX_DEPTH = 32;

export type CustomApiTransportErrorKind =
  | 'unsupported-content-type'
  | 'invalid-json'
  | 'empty-body'
  | 'excessive-depth'
  | 'size-limit';

/**
 * Thrown for every transport-level rejection (bad MIME, invalid/oversized/deep
 * body). Always mapped to a sanitized response by the caller — the message
 * never contains upstream body content.
 */
export class CustomApiTransportError extends Error {
  constructor(
    message: string,
    readonly kind: CustomApiTransportErrorKind,
  ) {
    super(message);
  }
}

const EXACT_JSON_MEDIA_TYPE = 'application/json';
const SUFFIXED_JSON_MEDIA_TYPE_PATTERN =
  /^application\/[a-z0-9.!#$%^&*_-]+\+json$/;

/**
 * Accepts `application/json`, `application/*+json` (optional parameters
 * allowed — only the media type before `;` is checked), and an absent
 * Content-Type (Admin static JSON Responses often omit it). Rejects every
 * other explicit MIME type, including HTML/text.
 */
export const isAcceptableJsonContentType = (
  contentType: string | null | undefined,
): boolean => {
  if (contentType == null || contentType.trim() === '') return true;
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    mediaType === EXACT_JSON_MEDIA_TYPE ||
    SUFFIXED_JSON_MEDIA_TYPE_PATTERN.test(mediaType)
  );
};

/**
 * Scans raw JSON text for container nesting depth without building or
 * recursing over the parsed structure, so a pathologically deep payload is
 * rejected before `JSON.parse` (or any later recursive walk) ever runs on it.
 * String contents (including escaped quotes) are skipped so bracket-like
 * characters inside strings are never counted.
 */
export const assertJsonDepthWithinLimit = (
  text: string,
  maxDepth: number = CUSTOM_API_JSON_MAX_DEPTH,
): void => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      depth += 1;
      if (depth > maxDepth) {
        throw new CustomApiTransportError(
          `JSON exceeds the maximum depth of ${maxDepth}`,
          'excessive-depth',
        );
      }
    } else if (char === '}' || char === ']') {
      depth -= 1;
    }
  }
};

const parseBoundedJsonText = (
  text: string,
  maxDepth: number = CUSTOM_API_JSON_MAX_DEPTH,
): unknown => {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new CustomApiTransportError('response body is empty', 'empty-body');
  }

  assertJsonDepthWithinLimit(trimmed, maxDepth);

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new CustomApiTransportError(
      'response body is not valid JSON',
      'invalid-json',
    );
  }
};

export interface BoundedJsonResult {
  readonly value: unknown;
  readonly bytes: number;
}

/**
 * Reads a `Response` body as bounded JSON: validates Content-Type, counts
 * actual decoded bytes as they stream in (so compressed/chunked transport
 * cannot hide an oversized payload behind a misleading or absent
 * Content-Length), aborts as soon as `maxBytes` is exceeded, and checks JSON
 * container depth before parsing. Always exhausts or cancels the body so the
 * underlying connection is released.
 */
export const readBoundedJson = async (
  response: Response,
  options: { maxBytes: number; maxDepth?: number },
): Promise<BoundedJsonResult> => {
  if (!isAcceptableJsonContentType(response.headers.get('content-type'))) {
    await response.body?.cancel();
    throw new CustomApiTransportError(
      'response has an unsupported Content-Type',
      'unsupported-content-type',
    );
  }

  const body = response.body;
  if (!body) {
    const text = await response.text();
    return {
      value: parseBoundedJsonText(text, options.maxDepth),
      bytes: Buffer.byteLength(text, 'utf8'),
    };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > options.maxBytes) {
        throw new CustomApiTransportError(
          `response exceeds the ${options.maxBytes}-byte limit`,
          'size-limit',
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return { value: parseBoundedJsonText(text, options.maxDepth), bytes };
};
