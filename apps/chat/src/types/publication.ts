import { FolderEditTree } from '@/src/store/publication/publication.types';

import { BackendDataNodeType, BackendResourceType } from './common';

import {
  MIMEType,
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';

// Dial Core uses and returns uppercase function names, so we need to keep PublicationFunctions in sync with it to fix validation
export enum PublicationFunctions {
  Equal = 'EQUAL',
  Contain = 'CONTAIN',
  Regex = 'REGEX',
  // TODO: uncomment when it will be supported on core
  // True = 'TRUE',
  // False = 'FALSE',
}

export interface PublicationRule {
  source: string;
  function: PublicationFunctions;
  targets: string[];
}

export interface BasePublicationRequestModel {
  displayAuthor?: string;
  targetFolder: string;
  rules?: PublicationRule[];
}

export interface PublicationRequestModel extends BasePublicationRequestModel {
  name?: string;
  resources: {
    action: PublishActions;
    sourceUrl: string;
    targetUrl: string;
    publishCredentials?: boolean;
  }[];
}

export enum PublicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface PublicationResource {
  action: PublishActions;
  sourceUrl: string | null;
  targetUrl: string;
  reviewUrl: string;
  author?: string;
  publishCredentials?: boolean;
}

export interface Publication {
  name?: string;
  url: string;
  targetFolder: string;
  publicationStatus: PublicationStatus;
  uploadStatus?: UploadStatus;
  createdAt: number;
  resources: PublicationResource[];
  rules?: PublicationRule[];
  resourceTypes: BackendResourceType[];
  author?: string;
  displayAuthor?: string;
}

export interface PublicationInfo {
  name?: string;
  url: string;
  targetFolder: string;
  status: PublicationStatus;
  createdAt: number;
  resourceTypes: BackendResourceType[];
  displayAuthor?: string;
}

export interface PublicationsListModel {
  publications: PublicationInfo[];
}

export interface PublishedByMeItem {
  name: string;
  parentPath: string;
  bucket: string;
  url: string;
  nodeType: BackendDataNodeType;
  resourceType: BackendResourceType;
}

export interface PublishedItem {
  name: string;
  parentPath: string;
  bucket: string;
  url: string;
  nodeType: BackendDataNodeType;
  resourceType: BackendResourceType;
  updatedAt: number;
  items?: PublishedItem[];
}

export interface PublishedFileItem extends PublishedItem {
  contentLength: number;
  contentType: MIMEType;
}

export interface PublishedList {
  name: string | null;
  parentPath: string | null;
  bucket: string;
  url: string;
  nodeType: BackendDataNodeType;
  resourceType: BackendResourceType;
  items?: PublishedItem[];
}

export interface TargetAudienceFilter {
  id: string;
  filterFunction: PublicationFunctions;
  filterParams: string[];
  source: string;
}

export type TargetAudienceFilterData = Omit<TargetAudienceFilter, 'id'>;

export interface ResourceToReview {
  publicationUrl: string;
  reviewUrl: string;
  sourceUrl: string;
  reviewed: boolean;
}

export interface PublicVersionOption {
  version: string;
  id: string;
}

export interface PublicVersionGroup {
  selectedVersion: PublicVersionOption;
  allVersions: PublicVersionOption[];
}

export type PublicVersionGroups = Record<
  string,
  PublicVersionGroup | undefined
>;

export interface PublicationHandlerState {
  entities: Record<string, { name: string; version: string }>;
  folders: FolderEditTree;
  rules: PublicationRule[];
  displayAuthor: string;
  publishToUrl: string;
}

export interface PublicationModel {
  entity: ShareEntity & { iconUrl?: string };
  action: PublishActions;
  isFolder?: boolean;
  publishCredentials?: boolean;
}
