const MAX_HIGHLIGHT_LENGTH = 50_000;
const MAX_HIGHLIGHT_LINE_LENGTH = 2_000;

/**
 * Bounds input sent to synchronous syntax highlighters. Oversized input should
 * render as complete plain text instead. Limits count UTF-16 code units and
 * recognize LF, CRLF, and CR line endings. This is a size guard, not a timeout
 * or a guarantee against pathological grammars on smaller inputs.
 */
export const isSyntaxHighlightingAllowed = (text: string): boolean => {
  if (text.length > MAX_HIGHLIGHT_LENGTH) return false;

  let lineLength = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '\n' || character === '\r') {
      lineLength = 0;
    } else if (++lineLength > MAX_HIGHLIGHT_LINE_LENGTH) {
      return false;
    }
  }

  return true;
};
