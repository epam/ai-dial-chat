import { BackendDataNodeType, BackendResourceType } from './common';

export enum PublicationFunctions {
  EQUAL = 'EQUAL',
  CONTAIN = 'CONTAIN',
  REGEX = 'REGEX',
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

export interface PublicationRequest {
  targetFolder: string;
  resources: {
    action: PublishActions;
    sourceUrl: string;
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
  reviewUrl: string | null;
}

export interface Publication {
  url: string;
  targetFolder?: string;
  status: PublicationStatus;
  createdAt: number;
  resources: PublicationResource[];
  rules?: PublicationRule[];
  resourceTypes: BackendResourceType[];
}

export interface PublicationInfo {
  url: string;
  targetFolder?: string;
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
  name: string;
}

export interface TargetAudienceFilter extends TargetAudienceFilterItem {
  filterFunction: PublicationFunctions;
  filterParams: string[];
}
