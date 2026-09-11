/**
 * Validation constants for the optional display author both publish request
 * bodies accept (`PublishCatalogEntityDto`, `PublishConversationDto`). Shared
 * so the two endpoints cannot drift into different limits for the same field.
 */

/** Matches the existing `PublishRuleDto.source`/`targets` free-text limit. */
export const DISPLAY_AUTHOR_MAX_LENGTH = 200;

/*
 * The display author is free-form text that never becomes a path, URL, or
 * resource id, so the allowlist regex `apps/chat-api/AGENTS.md` requires for
 * path-bound strings does not apply here. Control characters are still
 * rejected: the value is forwarded to DIAL Core and can come back through
 * Core's own error text into a log line.
 */
export const NO_CONTROL_CHARACTERS = /^[^\p{Cc}]*$/u;

/** Shared `@Matches` message, so both endpoints reject with identical wording. */
export const CONTROL_CHARACTERS_MESSAGE =
  'author must not contain control characters';
