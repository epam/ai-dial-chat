import type { Config } from 'dompurify';

/* Kept in lockstep with ANNOUNCEMENT_ALLOWED_TAGS in
 * apps/chat-api/src/app-config/html-sanitizer.ts. Widening one side without
 * the other means the server returns markup this pass silently strips. */
export const ANNOUNCEMENT_HTML_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'em', 'br', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};
