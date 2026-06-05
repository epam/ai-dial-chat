/** A single item returned by the DIAL Core `getConversationMetadata` endpoint. */
export type MetadataItem = {
  name?: string;
  url?: string;
  parentPath?: string;
  updatedAt?: number;
  nodeType?: string;
  sharedWithMe?: boolean;
  publishedWithMe?: boolean;
};

/** Wrapper around a `getConversationMetadata` SDK call result. */
export type MetadataResult = {
  data?: { items?: MetadataItem[]; nextToken?: string };
  error?: unknown;
};

/** Wrapper around a `getSharedResources` SDK call result. */
export type SharedResourcesResult = {
  data?: {
    resources?: {
      nodeType?: string;
      name?: string;
      url?: string;
      parentPath?: string;
    }[];
  };
  error?: unknown;
};

export type CompoundNextToken = { u?: string; p?: string };
