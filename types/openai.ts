export type OpenAIEntityModelType = 'model' | 'application' | 'assistant';
export type OpenAIEntityType = OpenAIEntityModelType | 'addon';

export interface OpenAIEntity {
  id: string;
  name: string;
  type: OpenAIEntityType;
}

export type OpenAIEntityModel = Omit<OpenAIEntity, 'type'> & {
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  requestLimit: number;
  isDefault?: boolean;
  type: OpenAIEntityModelType;
  selectedAddons?: string[];
};

export type OpenAIEntityAddon = Omit<OpenAIEntity, 'type'> & {
  type: 'addon';
};

export enum OpenAIEntityModelID {
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
  MIRROR = 'mirror',
  EPAM10K = 'epam10k',
  ASSISTANT10K = 'assistant-10k',
}

export enum OpenAIEntityAddonID {
  EPAM10K_SEMANTIC_SEARCH = 'epam-10k-semantic-search',
  EPAM10K_GOLDEN_QNA = 'epam-10k-golden-qna',
}

export const OpenAIEntityAddons: Record<
  OpenAIEntityAddonID,
  OpenAIEntityAddon
> = {
  [OpenAIEntityAddonID.EPAM10K_SEMANTIC_SEARCH]: {
    id: OpenAIEntityAddonID.EPAM10K_SEMANTIC_SEARCH,
    name: 'EPAM10K Semantic Search',
    type: 'addon',
  },
  [OpenAIEntityAddonID.EPAM10K_GOLDEN_QNA]: {
    id: OpenAIEntityAddonID.EPAM10K_GOLDEN_QNA,
    name: 'EPAM10K Golden QNA',
    type: 'addon',
  },
};

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = OpenAIEntityModelID.GPT_3_5_AZ;

export const OpenAIEntityModels: Record<
  OpenAIEntityModelID,
  OpenAIEntityModel
> = {
  [OpenAIEntityModelID.GPT_3_5]: {
    id: OpenAIEntityModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    requestLimit: 3000,
    type: 'model',
  },
  [OpenAIEntityModelID.GPT_3_5_AZ]: {
    id: OpenAIEntityModelID.GPT_3_5_AZ,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    requestLimit: 3000,
    type: 'model',
  },
  [OpenAIEntityModelID.GPT_4]: {
    id: OpenAIEntityModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.GPT_4_32K]: {
    id: OpenAIEntityModelID.GPT_4_32K,
    name: 'GPT-4-32K',
    maxLength: 96000,
    tokenLimit: 32000,
    requestLimit: 24000,
    type: 'model',
  },
  [OpenAIEntityModelID.BISON_001]: {
    id: OpenAIEntityModelID.BISON_001,
    name: 'PaLM2 (bison)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE]: {
    id: OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE,
    name: 'AWS (Titan)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT]: {
    id: OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT,
    name: 'AI21 (Jurassic-2 Grande)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT]: {
    id: OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT,
    name: 'AI21 (Jurassic-2 Jumbo)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1]: {
    id: OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
    name: 'Anthropic (Claude Instant)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1]: {
    id: OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1,
    name: 'Anthropic (Claude)',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'model',
  },
  [OpenAIEntityModelID.GPT_WORLD]: {
    id: OpenAIEntityModelID.GPT_WORLD,
    name: 'GPT World',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'application',
  },
  [OpenAIEntityModelID.MIRROR]: {
    id: OpenAIEntityModelID.MIRROR,
    name: 'Mirror',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'application',
  },
  [OpenAIEntityModelID.EPAM10K]: {
    id: OpenAIEntityModelID.EPAM10K,
    name: 'EPAM10K',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'application',
  },
  [OpenAIEntityModelID.ASSISTANT10K]: {
    id: OpenAIEntityModelID.ASSISTANT10K,
    name: 'ASSISTANT10K',
    maxLength: 24000,
    tokenLimit: 8000,
    requestLimit: 6000,
    type: 'assistant',
    selectedAddons: ['epam-10k-semantic-search'],
  },
};
