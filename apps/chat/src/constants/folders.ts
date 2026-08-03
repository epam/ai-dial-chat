export const MAX_FOLDERS_DEPTH = 3;
export const MAX_NESTED_FOLDERS = MAX_FOLDERS_DEPTH + 1;
export const MAX_NEW_FOLDER_PATH_SEGMENTS = MAX_NESTED_FOLDERS + 2;

export const FOLDER_ATTACHMENT_CONTENT_TYPE =
  'application/vnd.dial.metadata+json';

export const PROMPT_VARIABLE_REGEX_TEST = /{{([^|]+?)(\|.*?)?}}/;
export const PROMPT_VARIABLE_REGEX_GLOBAL = new RegExp(
  PROMPT_VARIABLE_REGEX_TEST,
  'g',
);

export const METADATA_PREFIX = 'metadata/';

export const TEMPORARY_FOLDER_ROOT_ID = 'temporary/temporaryBucket';
