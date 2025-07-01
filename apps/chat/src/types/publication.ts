import { BackendDataNodeType, BackendResourceType } from './common';
import { DialFile } from './files';

import {
  MIMEType,
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';

export enum PublicationFunctions {
  Equal = 'Equal',
  Contain = 'Contain',
  Regex = 'Regex',
  // TODO: uncomment when it will be supported on core
  // True = 'True',
  // False = 'False',
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
  name: string;
  resources: {
    action: PublishActions;
    sourceUrl?: string;
    targetUrl: string;
  }[];
}

export interface PublicationUpdateRequestModel
  extends BasePublicationRequestModel {
  resources: {
    action: PublishActions;
    sourceUrl: string;
    reviewUrl: string;
    targetUrl: string;
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

export interface TargetAudienceFilterItem {
  id: string;
}

export interface TargetAudienceFilter extends TargetAudienceFilterItem {
  filterFunction: PublicationFunctions;
  filterParams: string[];
}

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

export type PublicationReviewItem = ShareEntity | DialFile;
