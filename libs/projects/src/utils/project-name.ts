import { PROHIBITED_CONVERSATION_NAME_CHARS_RE } from '@epam/ai-dial-chat-shared';
import { ProjectNameError } from '../types/project-name-error';

/** Upper bound of a DIAL resource name, in UTF-8 bytes. */
export const PROJECT_NAME_MAX_BYTES = 255;

const PROHIBITED_CHAR_RE = new RegExp(
  PROHIBITED_CONVERSATION_NAME_CHARS_RE.source,
  'u',
);
/* Control characters, plus the NUL and bidi codepoints the BFF also rejects
 * but `PROHIBITED_CONVERSATION_NAME_CHARS_RE` does not carry. */
const CONTROL_OR_BIDI_RE = /[\p{Cc}‎‏‪-‮⁦-⁩]/u;
const RESERVED_NAMES = new Set([
  '.',
  '..',
  'v',
  'files',
  '.dial-resource',
  '.dial-folder',
]);

const utf8ByteLength = (value: string): number =>
  new TextEncoder().encode(value).length;

/**
 * Checks a project (or context file) name against the rule
 * `POST /api/v1/projects` enforces, so the form rejects early. The name is
 * trimmed first, because the host trims it before sending. Returns `null`
 * for a valid name.
 */
export const validateProjectName = (name: string): ProjectNameError | null => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return ProjectNameError.Required;
  if (utf8ByteLength(trimmed) > PROJECT_NAME_MAX_BYTES) {
    return ProjectNameError.TooLong;
  }
  if (PROHIBITED_CHAR_RE.test(trimmed) || CONTROL_OR_BIDI_RE.test(trimmed)) {
    return ProjectNameError.InvalidCharacters;
  }
  if (RESERVED_NAMES.has(trimmed)) return ProjectNameError.Reserved;
  return null;
};
