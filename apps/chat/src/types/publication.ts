import {
  BackendDataNodeType,
  BackendResourceType,
  UploadStatus,
} from './common';

export enum PublicationFunctions {
  Equal = 'Equal',
  Contain = 'Contain',
  Regex = 'Regex',
  // TODO: uncomment when it will be supported on core
  // True = 'True',
  // False = 'False',
}

export enum PublishActions {
  ADD = 'ADD',
  DELETE = 'DELETE',
}

export interface PublicationRule {
  source: string;
  function: PublicationFunctions;
  targets: string[];
}

export interface PublicationRequestModel {
  name: string;
  targetFolder: string;
  resources: {
    action: PublishActions;
    sourceUrl?: string;
    targetUrl: string;
  }[];
  rules?: PublicationRule[];
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
}

export interface PublicationInfo {
  name?: string;
  url: string;
  targetFolder: string;
  status: PublicationStatus;
  createdAt: number;
  resourceTypes: BackendResourceType[];
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
  reviewed: boolean;
  reviewUrl: string;
}
