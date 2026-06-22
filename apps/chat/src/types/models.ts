import { ApplicationStatus } from '@/src/types/applications';

import { EntityType } from './common';

import {
  EntityPublicationInfo,
  ShareEntity,
  ToolsetTransportType,
} from '@epam/ai-dial-shared';
import { TiktokenEncoding } from 'tiktoken';

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
  created_at: number;
  updated_at: number;
  owner: string;
  capabilities?: {
    embeddings: boolean;
    chat_completion: boolean;
  };
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
    temperature?: boolean;
    url_attachments?: boolean;
    folder_attachments?: boolean;
    allow_resume?: boolean;
    configuration?: boolean;
    tools?: boolean;
  };
  application_type_schema_id?: string;
  tokenizer_model?: TokenizerModel;
  description_keywords?: string[];

  function?: {
    status: ApplicationStatus;
  };
  viewer_url?: string;
  editor_url?: string;

  mcp?: {
    endpoint: string;
    transport: ToolsetTransportType;
    allowedTools?: string[];
    configDelivery?: string;
    forwardPerRequestKey?: boolean;
  };
}

export interface DialAIEntityFeatures {
  truncatePrompt: boolean;
  systemPrompt: boolean;
  temperature: boolean;
  urlAttachments: boolean;
  folderAttachments: boolean;
  allowResume: boolean;
  configuration: boolean;
  tools: boolean;
  assistantAttachmentsInRequest: boolean;
  mcp: boolean;
  chat_completion: boolean;
  responses_api: boolean;
}

export interface DialAIEntity {
  id: string;
  name: string;
  description?: string | undefined;
  iconUrl?: string | undefined;
  createdAt?: number;
  updatedAt?: number;
  owner?: string;
  type: EntityType;
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  version?: string;
  features?: DialAIEntityFeatures;
  tokenizer?: {
    encoding?: TiktokenEncoding;
    tokensPerMessage?: number;
  };
  applicationTypeSchemaId?: string;
}

export interface DialAIEntityModel
  extends Omit<ShareEntity, 'folderId'>,
    Omit<DialAIEntity, 'type'> {
  limits?: {
    maxTotalTokens: number;
    maxResponseTokens: number;
    maxRequestTokens: number;
    isMaxRequestTokensCustom: boolean;
  };
  tokenizer?: {
    encoding?: TiktokenEncoding;
    tokensPerMessage?: number;
  };
  type: EntityType;
  reference: string;
  isDefault: boolean;
  topics?: string[];

  functionStatus?: ApplicationStatus;
  applicationTypeSchemaId?: string;

  viewerUrl?: string;
  editorUrl?: string;

  mcp?: {
    endpoint: string;
    transport: ToolsetTransportType;
    allowedTools?: string[];
    configDelivery?: string;
    forwardPerRequestKey?: boolean;
  };
}

export interface InstalledModel {
  id: string;
  pinned?: boolean;
}

export interface PublishRequestDialAIEntityModel extends DialAIEntityModel {
  folderId: string;
  publicationInfo: EntityPublicationInfo;
}

export interface LimitUsage {
  total: number;
  used: number;
}

export interface AgentUsageStats {
  hourRequestStats: LimitUsage;
  dayRequestStats: LimitUsage;
  minuteTokenStats: LimitUsage;
  dayTokenStats: LimitUsage;
  weekTokenStats: LimitUsage;
  monthTokenStats: LimitUsage;
  minuteCostStats: LimitUsage;
  dayCostStats: LimitUsage;
  weekCostStats: LimitUsage;
  monthCostStats: LimitUsage;
}
