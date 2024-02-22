import { EntityType } from './common';

export interface ProxyOpenAIEntity<T = EntityType.Model> {
  id: string;
  object: T;
  display_name?: string;
  display_version?: string;
  icon_url?: string;
  description?: string;
  capabilities?: {
    embeddings: boolean;
    chat_completion: boolean;
  };
  addons?: string[];
  input_attachment_types?: string[];
  max_input_attachments?: number;
}

export interface OpenAIEntity {
  id: string;
  name: string;
  description?: string | undefined;
  iconUrl?: string | undefined;
  type: EntityType;
  selectedAddons?: string[];
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  version?: string;
}

export interface OpenAIEntityModel extends Omit<OpenAIEntity, 'type'> {
  maxLength: number; // maximum length of a message
  requestLimit: number;
  isDefault?: boolean;
  type: EntityType;
}

export interface OpenAIEntityAddon extends Omit<OpenAIEntity, 'type'> {
  type: EntityType.Addon;
}

export enum OpenAIEntityModelID {
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_32K = 'gpt-4-32k',
  BISON_001 = 'chat-bison@001',
  AMAZON_TITAN_TG1_LARGE = 'amazon.titan-tg1-large',
  AI21_J2_GRANDE_INSTRUCT = 'ai21.j2-grande-instruct',
  AI21_J2_JUMBO_INSTRUCT = 'ai21.j2-jumbo-instruct',
  ANTHROPIC_CLAUDE_INSTANT_V1 = 'anthropic.claude-instant-v1',
  ANTHROPIC_CLAUDE_V1 = 'anthropic.claude-v1',
  STABILITY_STABLE_DIFFUSION_XL = 'stability.stable-diffusion-xl',
  GPT_WORLD = 'gpt-world',
  MIRROR = 'mirror',
  EPAM10K = 'epam10k',
  ASSISTANT10K = 'assistant-10k',
  EPAM10K_SEMANTIC_SEARCH = 'epam10k-semantic-search',
  EPAM10K_GOLDEN_QNA = 'epam10k-golden-qna',
}

export enum OpenAIEntityAddonID {
  ADDON_EPAM10K_SEMANTIC_SEARCH = 'addon-epam10k-semantic-search',
  ADDON_EPAM10K_GOLDEN_QNA = 'addon-epam10k-golden-qna',
  ADDON_WOLFRAM = 'addon-wolfram',
}

export const OpenAIEntityAddons: Record<
  OpenAIEntityAddonID,
  OpenAIEntityAddon
> = {
  [OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH]: {
    id: OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH,
    name: 'EPAM10K Semantic Search',
    type: EntityType.Addon,
  },
  [OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA]: {
    id: OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA,
    name: 'EPAM10K Golden QNA',
    type: EntityType.Addon,
  },
  [OpenAIEntityAddonID.ADDON_WOLFRAM]: {
    id: OpenAIEntityAddonID.ADDON_WOLFRAM,
    name: 'Wolfram',
    type: EntityType.Addon,
  },
};

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = OpenAIEntityModelID.GPT_3_5_AZ;

export const defaultModelLimits = {
  maxLength: 24000,
  requestLimit: 6000,
};

export const OpenAIEntityModels: Record<string, OpenAIEntityModel> = {
  [OpenAIEntityModelID.GPT_3_5]: {
    id: OpenAIEntityModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    requestLimit: 3000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.GPT_3_5_AZ]: {
    id: OpenAIEntityModelID.GPT_3_5_AZ,
    name: 'GPT-3.5',
    maxLength: 12000,
    requestLimit: 3000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.GPT_4]: {
    id: OpenAIEntityModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.GPT_4_32K]: {
    id: OpenAIEntityModelID.GPT_4_32K,
    name: 'GPT-4-32K',
    maxLength: 96000,
    requestLimit: 24000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.BISON_001]: {
    id: OpenAIEntityModelID.BISON_001,
    name: 'PaLM2 (bison)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE]: {
    id: OpenAIEntityModelID.AMAZON_TITAN_TG1_LARGE,
    name: 'AWS (Titan)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT]: {
    id: OpenAIEntityModelID.AI21_J2_GRANDE_INSTRUCT,
    name: 'AI21 (Jurassic-2 Grande)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT]: {
    id: OpenAIEntityModelID.AI21_J2_JUMBO_INSTRUCT,
    name: 'AI21 (Jurassic-2 Jumbo)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1]: {
    id: OpenAIEntityModelID.ANTHROPIC_CLAUDE_INSTANT_V1,
    name: 'Anthropic (Claude Instant)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1]: {
    id: OpenAIEntityModelID.ANTHROPIC_CLAUDE_V1,
    name: 'Anthropic (Claude)',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.STABILITY_STABLE_DIFFUSION_XL]: {
    id: OpenAIEntityModelID.STABILITY_STABLE_DIFFUSION_XL,
    name: 'Stable Diffusion XL',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.EPAM10K_GOLDEN_QNA]: {
    id: OpenAIEntityModelID.EPAM10K_GOLDEN_QNA,
    name: 'EPAM10K Golden QNA',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.EPAM10K_SEMANTIC_SEARCH]: {
    id: OpenAIEntityModelID.EPAM10K_SEMANTIC_SEARCH,
    name: 'EPAM10K Semantic Search',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Model,
  },
  [OpenAIEntityModelID.GPT_WORLD]: {
    id: OpenAIEntityModelID.GPT_WORLD,
    name: 'GPT World',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Application,
  },
  [OpenAIEntityModelID.MIRROR]: {
    id: OpenAIEntityModelID.MIRROR,
    name: 'Echo',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Application,
  },
  [OpenAIEntityModelID.EPAM10K]: {
    id: OpenAIEntityModelID.EPAM10K,
    name: 'EPAM10K',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Application,
  },
  [OpenAIEntityModelID.ASSISTANT10K]: {
    id: OpenAIEntityModelID.ASSISTANT10K,
    name: 'ASSISTANT10K',
    maxLength: 24000,
    requestLimit: 6000,
    type: EntityType.Assistant,
    selectedAddons: [OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH],
  },
};
