import { Injectable, Logger } from '@nestjs/common';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { DialClientService } from '../dial/dial-client.service';
import {
  ResourceDependenciesResultDto,
  ResourceDependencyDto,
} from '../publish/dto/resource-dependency.dto';
import { collectConversationDependencies } from './utils/conversation-dependencies.util';

/**
 * Lists the direct dependencies of a conversation that are not in the public
 * bucket. The conversation is read from the caller's own bucket, as publish
 * reads it. Resolution is best-effort: the list is advisory, so a failure
 * yields an empty list instead of an error.
 */
@Injectable()
export class ConversationPublishDependenciesService {
  private readonly logger = new Logger(
    ConversationPublishDependenciesService.name,
  );

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * @param accessToken - caller's bearer token
   * @param bucket - caller's session bucket
   * @param path - the conversation's path in the caller's bucket
   */
  async getDependencies(
    accessToken: string,
    bucket: string,
    path: string,
  ): Promise<ResourceDependenciesResultDto> {
    let dependencies: ResourceDependencyDto[] = [];
    try {
      const result = await this.dialClient.client.getConversation(
        bucket,
        encodeDialResourcePath(path),
        { headers: getBearerAuthHeaders(accessToken) },
      );
      if (result.error != null || result.data == null) {
        throw new Error(
          `conversation read failed with status ${result.response?.status}`,
        );
      }
      dependencies = collectConversationDependencies(result.data, bucket);
    } catch (err) {
      this.logger.warn(
        `Could not resolve the publish dependencies of conversation "${path}": ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
    return { dependencies };
  }
}
