import { EntityType } from './common';

import { TiktokenEncoding } from '@dqbd/tiktoken';

export type ModelsMap = Partial<Record<string, DialAIEntityModel>>;

export enum TokenizerModel {
  GPT_35_TURBO_0301 = 'gpt-3.5-turbo-0301',
  GPT_4_0314 = 'gpt-4-0314',
  GPT_4_1106_VISION_PREVIEW = 'gpt-4-1106-vision-preview',
}

export interface CoreAIEntity<T = EntityType.Model> {
  id: string;
  reference: string;
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

  limits?: {
    max_total_tokens?: number;
    max_completion_tokens?: number;
    max_prompt_tokens?: number;
  };
  features?: {
    truncate_prompt?: boolean;
    system_prompt?: boolean;
    url_attachments?: boolean;
    folder_attachments?: boolean;
    allowResume?: boolean;
  };
  tokenizer_model?: TokenizerModel;
}

export interface DialAIEntity {
  id: string;
  name: string;
  description?: string | undefined;
  iconUrl?: string | undefined;
  type: EntityType;
  selectedAddons?: string[];
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  version?: string;
  features?: {
    truncatePrompt?: boolean;
    systemPrompt?: boolean;
    urlAttachments?: boolean;
    folderAttachments?: boolean;
    allowResume?: boolean;
  };
  tokenizer?: {
    encoding?: TiktokenEncoding;
    tokensPerMessage?: number;
  };
}

export interface DialAIEntityModel extends Omit<DialAIEntity, 'type'> {
  isDefault: boolean;
  limits?: {
    maxTotalTokens: number;
    maxResponseTokens: number;
    maxRequestTokens: number;
    isMaxRequestTokensCustom: boolean;
  };
  type: EntityType;
  reference: string;
}

export interface DialAIEntityAddon extends Omit<DialAIEntity, 'type'> {
  type: EntityType.Addon;
}
