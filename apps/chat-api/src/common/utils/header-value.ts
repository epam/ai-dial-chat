/** Header DIAL Core reads the originating conversation id from. */
export const CONVERSATION_ID_HEADER = 'X-CONVERSATION-ID';

/** Header DIAL Core reads the caller's job title from. */
export const JOB_TITLE_HEADER = 'X-JOB-TITLE';

/*
 * HTTP field values are bytes, not text: Node's `fetch` (undici) converts every
 * header value to a ByteString and throws
 * `Cannot convert argument to a ByteString because the character at index N has
 * a value of ... which is greater than 255` for any codepoint above U+00FF.
 * Conversation ids embed the user-authored title (`{bucket}/{deploymentId}__{title}__{uuid}`),
 * so a prompt containing an em dash, Cyrillic text, an emoji or a currency sign
 * made every completion request for that conversation fail outright.
 *
 * Percent-encoding the UTF-8 bytes keeps the value a valid field value while
 * leaving plain-ASCII ids — every id that worked before — byte-identical, so
 * DIAL Core sees exactly what it sees today for them. Space is left as-is
 * (SP is legal inside field content and appears in most titles); `%` is
 * encoded so the transformation stays reversible, and control characters are
 * encoded rather than passed through.
 */
const SAFE_BYTE_MIN = 0x20;
const SAFE_BYTE_MAX = 0x7e;
const PERCENT_BYTE = 0x25;

/**
 * Percent-encodes the UTF-8 bytes of `value` that cannot appear literally in an
 * HTTP header value. Never throws — lone surrogates are replaced by
 * `TextEncoder` before encoding.
 */
export const encodeHeaderValue = (value: string): string => {
  let encoded = '';
  for (const byte of new TextEncoder().encode(value)) {
    encoded +=
      byte >= SAFE_BYTE_MIN && byte <= SAFE_BYTE_MAX && byte !== PERCENT_BYTE
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return encoded;
};

/**
 * Builds the `X-CONVERSATION-ID` header object for spreading into a DIAL Core
 * call's `headers`, omitting it when no conversation id is available.
 */
export const buildConversationIdHeaders = (
  conversationId?: string,
): Record<string, string> =>
  conversationId
    ? { [CONVERSATION_ID_HEADER]: encodeHeaderValue(conversationId) }
    : {};

/**
 * Builds the `X-JOB-TITLE` header object for spreading into a DIAL Core
 * call's `headers`, omitting it when no job title is available.
 */
export const buildJobTitleHeaders = (
  jobTitle?: string,
): Record<string, string> =>
  jobTitle ? { [JOB_TITLE_HEADER]: encodeHeaderValue(jobTitle) } : {};
