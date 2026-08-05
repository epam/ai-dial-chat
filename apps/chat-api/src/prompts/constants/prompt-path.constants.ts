export const PROMPT_NAME_PATTERN = /^(?!\.{1,2}$)[a-zA-Z0-9 _.-]+$/;

export const PROMPT_PATH_PATTERN =
  /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[a-zA-Z0-9 _.-]+(?:\/[a-zA-Z0-9 _.-]+)*$/;

export const OPTIONAL_PROMPT_PATH_PATTERN =
  /^(?:|(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[a-zA-Z0-9 _.-]+(?:\/[a-zA-Z0-9 _.-]+)*)$/;

export const PROMPT_NAME_VALIDATION_MESSAGE =
  'name may only contain letters, digits, spaces, _, ., and - and must not be . or ..';

export const PROMPT_PATH_VALIDATION_MESSAGE =
  'path must contain safe slash-separated segments and must not contain traversal segments';
