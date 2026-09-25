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

/** One share grant on a resource, as reported by DIAL Core `share/list`. */
export interface ShareGrant {
  user?: string;
  /** Epoch ms at which the recipient accepted the share invitation. */
  acceptedAt?: number;
}

/** Wrapper around a `getSharedResources` SDK call result. */
export interface SharedResourcesResult {
  data?: {
    resources?: Array<
      Pick<MetadataItem, 'nodeType' | 'name' | 'url' | 'parentPath'> & {
        sharedBy?: ShareGrant[];
      }
    >;
  };
  error?: unknown;
}

export interface CompoundNextToken {
  u?: string;
  p?: string;
}
