import { OPENAI_API_TYPE } from '../utils/app/const';

export interface OpenAIModel {
  id: string;
  name: string;
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  requestLimit: number;
}

export enum OpenAIModelID {
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_32K = 'gpt-4-32k',
  BISON_001 = 'chat-bison',
  AMAZON_TITAN_TG1_LARGE = 'amazon.titan-tg1-large',
  AI21_J2_GRANDE_INSTRUCT = 'ai21.j2-grande-instruct',
  AI21_J2_JUMBO_INSTRUCT = 'ai21.j2-jumbo-instruct',
  ANTHROPIC_CLAUDE_INSTANT_V1 = 'anthropic.claude-instant-v1',
  ANTHROPIC_CLAUDE_V1 = 'anthropic.claude-v1',
}

export const googleModels = [OpenAIModelID.BISON_001];

export const bedrockModels = [
  OpenAIModelID.AMAZON_TITAN_TG1_LARGE,
  OpenAIModelID.AI21_J2_GRANDE_INSTRUCT,
  OpenAIModelID.AI21_J2_JUMBO_INSTRUCT,
  OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
  OpenAIModelID.ANTHROPIC_CLAUDE_V1,
];

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID =
  OPENAI_API_TYPE === 'azure'
    ? OpenAIModelID.GPT_3_5_AZ
    : OpenAIModelID.GPT_3_5;

export const OpenAIModels: Record<OpenAIModelID, OpenAIModel> = {
  [OpenAIModelID.GPT_3_5]: {
    id: OpenAIModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    requestLimit: 3000,
  },
  [OpenAIModelID.GPT_3_5_AZ]: {
    id: OpenAIModelID.GPT_3_5_AZ,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    requestLimit: 3000,
  },
  [OpenAIModelID.GPT_4]: {
    id: OpenAIModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
  },
  [OpenAIModelID.GPT_4_32K]: {
    id: OpenAIModelID.GPT_4_32K,
    name: 'GPT-4-32K',
    maxLength: 96000,
    tokenLimit: 32000,
    requestLimit: 24000,
  },
  [OpenAIModelID.BISON_001]: {
    id: OpenAIModelID.BISON_001,
    name: 'PaLM2 (bison)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
  },
  [OpenAIModelID.AMAZON_TITAN_TG1_LARGE]: {
    id: OpenAIModelID.AMAZON_TITAN_TG1_LARGE,
    name: 'Titan',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
  },
  [OpenAIModelID.AI21_J2_GRANDE_INSTRUCT]: {
    id: OpenAIModelID.AI21_J2_GRANDE_INSTRUCT,
    name: 'Jurassic-2 Grande',
    maxLength: 24000,
    tokenLimit: 8191,
    requestLimit: 6000,
  },
  [OpenAIModelID.AI21_J2_JUMBO_INSTRUCT]: {
    id: OpenAIModelID.AI21_J2_JUMBO_INSTRUCT,
    name: 'Jurassic-2 Jumbo',
    maxLength: 24000,
    tokenLimit: 8191,
    requestLimit: 6000,
  },
  [OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1]: {
    id: OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
    name: 'Claude Instant',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
  },
  [OpenAIModelID.ANTHROPIC_CLAUDE_V1]: {
    id: OpenAIModelID.ANTHROPIC_CLAUDE_V1,
    name: 'Claude',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
  },
};
