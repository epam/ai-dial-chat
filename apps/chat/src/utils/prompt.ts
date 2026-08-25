import { PromptFieldError } from '../types/prompt';

/**
 * Mirrors the backend's `PROMPT_NAME_PATTERN`
 * (`apps/chat-api/src/prompts/constants/prompt-path.constants.ts`): an
 * allowlist of letters, digits, spaces, `_`, `.` and `-`, excluding the
 * traversal names `.` and `..`.
 */
const PROMPT_NAME_PATTERN = /^(?!\.{1,2}$)[a-zA-Z0-9 _.-]+$/;

/** Maximum name length accepted by `CreatePromptDto.name`. */
export const PROMPT_NAME_MAX_LENGTH = 256;

/** Maximum description length accepted by `CreatePromptDto.description`. */
export const PROMPT_DESCRIPTION_MAX_LENGTH = 2000;

/** Maximum body length accepted by `CreatePromptDto.content`. */
export const PROMPT_CONTENT_MAX_LENGTH = 50000;

/** How close to a length limit the remaining-characters counter starts announcing. */
export const PROMPT_COUNTER_ANNOUNCE_THRESHOLD = 10;

/** Validates a prompt or folder name against the backend's own rules. */
export const validatePromptName = (name: string): PromptFieldError | null => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return PromptFieldError.Required;
  if (trimmed.length > PROMPT_NAME_MAX_LENGTH) return PromptFieldError.TooLong;
  if (!PROMPT_NAME_PATTERN.test(trimmed)) return PromptFieldError.InvalidName;
  return null;
};

/** Validates a prompt description; an empty description is valid. */
export const validatePromptDescription = (
  description: string,
): PromptFieldError | null =>
  description.length > PROMPT_DESCRIPTION_MAX_LENGTH
    ? PromptFieldError.TooLong
    : null;

/** Validates a prompt body: required, and within the backend's length limit. */
export const validatePromptContent = (
  content: string,
): PromptFieldError | null => {
  if (content.trim().length === 0) return PromptFieldError.Required;
  if (content.length > PROMPT_CONTENT_MAX_LENGTH) {
    return PromptFieldError.TooLong;
  }
  return null;
};

/**
 * Returns the characters left before a limit, or `null` while still further
 * away than the announce threshold — a counter that fires on every keystroke
 * is unusable noise in a live region.
 */
export const getRemainingCharacters = (
  value: string,
  maxLength: number,
): number | null => {
  const remaining = maxLength - value.length;
  return remaining <= PROMPT_COUNTER_ANNOUNCE_THRESHOLD ? remaining : null;
};

/** Joins a folder path and a prompt name into the DIAL prompt path used as an id. */
export const buildPromptPath = (folderId: string, name: string): string =>
  folderId ? `${folderId}/${name}` : name;
