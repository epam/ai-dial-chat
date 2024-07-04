export interface ApplicationFeatures {
  rate_endpoint: string;
  configuration_endpoint: string;
}

export interface CreateApplicationModel {
  endpoint: string;
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  features: ApplicationFeatures;
  inputAttachmentTypes?: string[];
  maxInputAttachments?: number;
  defaults?: Record<string, unknown>;
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
