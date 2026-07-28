import type { Config } from 'dompurify';

export const FOOTER_HTML_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: ['a', 'span', 'strong', 'u', 'em', 'br', 'p'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'data-dial-action'],
};
