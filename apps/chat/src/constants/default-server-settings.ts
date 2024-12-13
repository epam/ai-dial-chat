import { FALLBACK_MODEL_ID } from './default-ui-settings';

export const DIAL_API_HOST = process.env.DIAL_API_HOST;

export const DIAL_API_VERSION = process.env.DIAL_API_VERSION || '2024-02-01';

export const DEFAULT_MODEL_ID = process.env.DEFAULT_MODEL || FALLBACK_MODEL_ID;

export const MAX_PROMPT_TOKENS_DEFAULT_PERCENT = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_PERCENT
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_PERCENT, 10)
  : 75;

export const MAX_PROMPT_TOKENS_DEFAULT_VALUE = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_VALUE
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_VALUE, 10)
  : 2000;

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';
