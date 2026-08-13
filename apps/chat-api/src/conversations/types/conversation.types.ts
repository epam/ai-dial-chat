import { ConversationMetadataDto } from '../../openapi/openapi-response.dto';

export interface MetadataItem extends Partial<ConversationMetadataDto> {
  sharedWithMe?: boolean;
  publishedWithMe?: boolean;
}

/** Wrapper around a `getConversationMetadata` SDK call result. */
export interface MetadataResult {
  data?: { items?: MetadataItem[]; nextToken?: string };
  error?: unknown;
  response?: globalThis.Response;
}

/** Wrapper around a `getSharedResources` SDK call result. */
export interface SharedResourcesResult {
  data?: {
    resources?: Array<
      Pick<MetadataItem, 'nodeType' | 'name' | 'url' | 'parentPath'>
    >;
  };
  error?: unknown;
}

export interface CompoundNextToken {
  u?: string;
  p?: string;
}
