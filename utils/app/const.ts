export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? "";
  // "You are ChatGPT, a large language model trained by OpenAI. Follow the user's instructions carefully. Respond using markdown.";

export const OPENAI_API_HOST =
  process.env.OPENAI_API_HOST || 'https://api.openai.com';

export const DEFAULT_TEMPERATURE =
  parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || "1");

export const OPENAI_API_TYPE =
  process.env.OPENAI_API_TYPE || 'openai';

export const OPENAI_API_VERSION =
  process.env.OPENAI_API_VERSION || '2023-03-15-preview';

export const OPENAI_ORGANIZATION =
  process.env.OPENAI_ORGANIZATION || '';

export const MAX_TOKENS = 1000;

export const GOOGLE_MAX_OUTPUT_TOKENS = +(process.env.GOOGLE_AI_MAX_OUTPUT_TOKENS ?? 1024);

export const GOOGLE_TOP_P = +(process.env.GOOGLE_AI_TOP_P ?? 0.8);

export const GOOGLE_TOP_K = +(process.env.GOOGLE_AI_TOP_K ?? 40);

export const BEDROCK_HOST =
  process.env.BEDROCK_HOST || "http://openai-bedrock-adapter.openai-bedrock-adapter";