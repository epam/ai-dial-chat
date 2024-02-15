import { OpenAIEntityModelID, OpenAIEntityModels } from '@/src/types/openai';

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';

export const DIAL_API_HOST = process.env.DIAL_API_HOST;

export const DEFAULT_TEMPERATURE = parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE ?? '1',
);
export const MAX_ENTITY_LENGTH = 160;

export const DEFAULT_CONVERSATION_NAME = 'New conversation';
export const DEFAULT_PROMPT_NAME = 'Prompt';
export const DEFAULT_FOLDER_NAME = 'New folder';
export const EMPTY_MODEL_ID = 'empty';

export const DIAL_API_VERSION =
  process.env.DIAL_API_VERSION || '2023-03-15-preview';

export const DEFAULT_ASSISTANT_SUBMODEL =
  OpenAIEntityModels[OpenAIEntityModelID.GPT_4];
