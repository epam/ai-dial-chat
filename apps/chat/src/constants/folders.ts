export const MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH = 3;

export const FOLDER_ATTACHMENT_CONTENT_TYPE =
  'application/vnd.dial.metadata+json';

export const PROMPT_VARIABLE_REGEX_TEST = /{{([^|]+?)(\|.*?)?}}/;
export const PROMPT_VARIABLE_REGEX_GLOBAL = new RegExp(
  PROMPT_VARIABLE_REGEX_TEST,
  'g',
);

export const METADATA_PREFIX = 'metadata/';
