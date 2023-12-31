import { OpenAIEntityModelID, OpenAIEntityModels } from '@/src/types/openai';

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';

export const DIAL_API_HOST = process.env.DIAL_API_HOST;

export const DEFAULT_TEMPERATURE = parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || '1',
);

export const DEFAULT_CONVERSATION_NAME = 'New conversation';

export const DIAL_API_VERSION =
  process.env.DIAL_API_VERSION || '2023-03-15-preview';

export const DEFAULT_ASSISTANT_SUBMODEL =
  OpenAIEntityModels[OpenAIEntityModelID.GPT_4];
