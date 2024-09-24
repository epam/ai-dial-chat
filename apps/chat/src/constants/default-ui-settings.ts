export const SIDEBAR_MIN_WIDTH = 260;
export const MOBILE_SIDEBAR_MIN_WIDTH = 320;
export const HEADER_HEIGHT = 48;

export const DEFAULT_CONVERSATION_NAME = 'New conversation';
export const DEFAULT_PROMPT_NAME = 'Prompt';
export const DEFAULT_FOLDER_NAME = 'New folder';
export const EMPTY_MODEL_ID = 'empty';

export const FALLBACK_MODEL_ID = 'gpt-35-turbo';

export const MAX_ENTITY_LENGTH = 160;

export const DEFAULT_ASSISTANT_SUBMODEL_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_SUB_MODEL ?? 'gpt-4';

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';

export const DEFAULT_TEMPERATURE = parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE ?? '1',
);
