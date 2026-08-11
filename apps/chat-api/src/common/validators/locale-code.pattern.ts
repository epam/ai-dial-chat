/**
 * BCP-47-ish locale code: a two-letter language subtag with an optional
 * region/script subtag (e.g. `en`, `de`, `en-US`, `pt-BR`).
 */
export const LOCALE_CODE_PATTERN = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;

export const LOCALE_CODE_VALIDATION_MESSAGE =
  'Must be a two-letter language code, optionally followed by a region/script subtag (e.g. "de", "en-US")';
