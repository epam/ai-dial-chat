import { PayloadAction } from '@reduxjs/toolkit';

export interface ApplicationFeatures {
  rate_endpoint?: string;
  configuration_endpoint?: string;
  truncatePrompt?: boolean;
  systemPrompt?: boolean;
  urlAttachments?: boolean;
  folderAttachments?: boolean;
}

export interface CreateApplicationModel {
  endpoint: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  features?: ApplicationFeatures;
  input_attachment_types?: string[];
  max_input_attachments?: number;
  defaults?: Record<string, unknown>;
}

export interface ApplicationMoveModel {
  sourceUrl: string;
  destinationUrl: string;
  overwrite: boolean;
}

export interface ApplicationListItemModel {
  name: string;
  parentPath: null;
  bucket: string;
  url: string;
  nodeType: string;
  resourceType: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApplicationListResponseModel {
  name: string;
  parentPath: null;
  bucket: string;
  url: string;
  nodeType: string;
  resourceType: string;
  files: ApplicationListItemModel[];
  items: string[];
}

export interface FileModel {
  name: string;
  parentPath?: null;
  bucket: string;
  url: string;
  nodeType: string;
  resourceType: string;
  createdAt: number;
  updatedAt: number;
}

export interface ListResponseModel {
  name: string;
  parentPath?: null;
  bucket: string;
  url: string;
  nodeType: string;
  resourceType: string;
  files: FileModel[];
}

export interface ApplicationDetailsResponse {
  name: string;
  endpoint: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  forward_auth_token: boolean;
  input_attachment_types: string[];
  max_input_attachments: number;
  features: Record<string, string>;
  defaults: Record<string, unknown>;
  reference: string;
}

export interface ReadOnlyAppDetailsResponse {
  id: string;
  application: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  owner: string;
  object: string;
  status: string;
  created_at: number;
  updated_at: number;
  features: {
    [key: string]: boolean;
  };
  defaults: Record<string, unknown>;
}

export interface OpenAIApplicationListItem {
  id: string;
  application: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  owner: string;
  object: string;
  status: string;
  created_at: number;
  updated_at: number;
  features: {
    [key: string]: boolean;
  };
  defaults: Record<string, unknown>;
}

export interface OpenAIApplicationListResponse {
  data: OpenAIApplicationListItem[];
  object: string;
}

export interface FeaturesData {
  rate?: boolean;
  tokenize?: boolean;
  truncatePrompt?: boolean;
  configurations?: boolean;
  systemPrompt?: boolean;
  tools?: boolean;
  seed?: boolean;
  urlAttachments?: boolean;
  folderAttachments?: boolean;
}

export type DeleteApplicationAction = PayloadAction<string>;
