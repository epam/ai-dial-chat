import { ApplicationStatus } from '@/src/types/applications';

import { EntityType } from './common';

import { TiktokenEncoding } from '@dqbd/tiktoken';
import { EntityPublicationInfo } from '@epam/ai-dial-shared';

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
    allow_resume?: boolean;
  };
  tokenizer_model?: TokenizerModel;
  description_keywords?: string[];

  function?: {
    status: ApplicationStatus;
  };
}

export interface DialAIEntityFeatures {
  truncatePrompt?: boolean;
  systemPrompt?: boolean;
  urlAttachments?: boolean;
  folderAttachments?: boolean;
  allowResume?: boolean;
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
  features?: DialAIEntityFeatures;
  tokenizer?: {
    encoding?: TiktokenEncoding;
    tokensPerMessage?: number;
  };
}

export interface DialAIEntityModel extends Omit<DialAIEntity, 'type'> {
  limits?: {
    maxTotalTokens: number;
    maxResponseTokens: number;
    maxRequestTokens: number;
    isMaxRequestTokensCustom: boolean;
  };
  type: EntityType;
  reference: string;
  isDefault: boolean;
  topics?: string[];

  functionStatus?: ApplicationStatus;
}

export interface DialAIEntityAddon extends Omit<DialAIEntity, 'type'> {
  type: EntityType.Addon;
}

export interface InstalledModel {
  id: string;
  pinned?: boolean;
}

export interface PublishRequestDialAIEntityModel extends DialAIEntityModel {
  folderId: string;
  publicationInfo: EntityPublicationInfo;
}
