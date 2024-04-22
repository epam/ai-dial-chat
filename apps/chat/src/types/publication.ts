import { BackendDataNodeType, BackendResourceType } from './common';

enum PublicationFunctions {
  EQUAL = 'EQUAL',
  CONTAIN = 'CONTAIN',
  REGEX = 'REGEX',
  FALSE = 'FALSE',
  TRUE = 'TRUE',
}

interface PublicationRule {
  source: string;
  function: PublicationFunctions;
  targets: string[];
}

export interface PublicationRequest {
  url: string;
  targetUrl: string;
  resources: { sourceUrl: string; targetUrl: string }[];
  rules?: PublicationRule[];
}

enum PublicationStatus {
  PENDING = 'PENDING',
}

export interface PublicationResource {
  sourceUrl: string;
  targetUrl: string;
  reviewUrl: string;
}

export interface Publication {
  url: string;
  targetUrl: string;
  status: PublicationStatus;
  createdAt: number;
  resources: PublicationResource[];
  rules?: PublicationRule[];
}

export interface PublicationInfo {
  url: string;
  targetUrl: string;
  status: PublicationStatus;
  createdAt: number;
}

export interface PublicationsListModel {
  publications: PublicationInfo[];
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
