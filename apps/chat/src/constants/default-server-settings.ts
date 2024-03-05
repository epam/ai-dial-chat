export const DIAL_API_HOST = process.env.DIAL_API_HOST;

export const DIAL_API_VERSION =
  process.env.DIAL_API_VERSION || '2023-03-15-preview';

export const MAX_PROMPT_TOKENS_DEFAULT_PERCENT = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_PERCENT
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_PERCENT, 10)
  : 75;

export const MAX_PROMPT_TOKENS_DEFAULT_VALUE = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_VALUE
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_VALUE, 10)
  : 2000;
