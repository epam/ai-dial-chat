import { OPENAI_API_TYPE } from '../utils/app/const';

export type OpenAIModelType = 'languageModel' | 'application';

export interface OpenAIModel {
  id: string;
  name: string;
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  requestLimit: number;
  isDefault?: boolean;
  type: OpenAIModelType;
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
  GPT_WORLD = 'gpt-world',
}

export const openAIModels = [
  OpenAIModelID.GPT_3_5,
  OpenAIModelID.GPT_3_5_AZ,
  OpenAIModelID.GPT_4,
  OpenAIModelID.GPT_4_32K,
];

export const googleModels = [OpenAIModelID.BISON_001];

export const bedrockModels = [
  OpenAIModelID.AMAZON_TITAN_TG1_LARGE,
  OpenAIModelID.AI21_J2_GRANDE_INSTRUCT,
  OpenAIModelID.AI21_J2_JUMBO_INSTRUCT,
  OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
  OpenAIModelID.ANTHROPIC_CLAUDE_V1,
];

export const applicationsModels = [OpenAIModelID.GPT_WORLD];

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
    type: 'languageModel',
  },
  [OpenAIModelID.GPT_3_5_AZ]: {
    id: OpenAIModelID.GPT_3_5_AZ,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    requestLimit: 3000,
    type: 'languageModel',
  },
  [OpenAIModelID.GPT_4]: {
    id: OpenAIModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.GPT_4_32K]: {
    id: OpenAIModelID.GPT_4_32K,
    name: 'GPT-4-32K',
    maxLength: 96000,
    tokenLimit: 32000,
    requestLimit: 24000,
    type: 'languageModel',
  },
  [OpenAIModelID.BISON_001]: {
    id: OpenAIModelID.BISON_001,
    name: 'PaLM2 (bison)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.AMAZON_TITAN_TG1_LARGE]: {
    id: OpenAIModelID.AMAZON_TITAN_TG1_LARGE,
    name: 'AWS (Titan)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.AI21_J2_GRANDE_INSTRUCT]: {
    id: OpenAIModelID.AI21_J2_GRANDE_INSTRUCT,
    name: 'AI21 (Jurassic-2 Grande)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.AI21_J2_JUMBO_INSTRUCT]: {
    id: OpenAIModelID.AI21_J2_JUMBO_INSTRUCT,
    name: 'AI21 (Jurassic-2 Jumbo)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1]: {
    id: OpenAIModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
    name: 'Anthropic (Claude Instant)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.ANTHROPIC_CLAUDE_V1]: {
    id: OpenAIModelID.ANTHROPIC_CLAUDE_V1,
    name: 'Anthropic (Claude)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'languageModel',
  },
  [OpenAIModelID.GPT_WORLD]: {
    id: OpenAIModelID.GPT_WORLD,
    name: 'GPT World',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'application',
  },
};
