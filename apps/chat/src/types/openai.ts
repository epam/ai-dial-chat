import { EntityType } from './common';

export interface CoreAIEntity<T = EntityType.Model> {
  id: string;
  object: T;
  display_name?: string;
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
}

export interface DialAIEntityModel extends Omit<DialAIEntity, 'type'> {
  limits?: {
    maxTotalTokens: number;
    maxResponseTokens: number;
    maxRequestTokens: number;
  };
  type: EntityType;
}

export interface DialAIEntityAddon extends Omit<DialAIEntity, 'type'> {
  type: EntityType.Addon;
}
