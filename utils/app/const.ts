import { OpenAIEntityModelID, OpenAIEntityModels } from '@/types/openai';

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';
// "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown.";

export const OPENAI_API_HOST =
  process.env.OPENAI_API_HOST || 'https://api.openai.com';

export const DEFAULT_TEMPERATURE = parseFloat(
  process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || '1',
);

export const DEFAULT_CONVERSATION_NAME = 'New conversation';

export const OPENAI_API_VERSION =
  process.env.OPENAI_API_VERSION || '2023-03-15-preview';

export const MAX_TOKENS = 1000;

export const DEFAULT_ASSISTANT_SUBMODEL =
  OpenAIEntityModels[OpenAIEntityModelID.GPT_4];
