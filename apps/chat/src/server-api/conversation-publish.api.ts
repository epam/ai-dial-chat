import type {
  PublishConversationResultDto,
  UnpublishConversationResultDto,
} from '@epam/ai-dial-chat-api-client';
import { toPublishRuleDto } from '@epam/ai-dial-chat-hooks';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { conversationsApi } from './api-client';

export const publishConversation = (
  path: string,
  folderPath: string,
  rules: PublicationRule[],
): Promise<PublishConversationResultDto> =>
  conversationsApi.publishConversation({
    path,
    publishConversationDto: { folderPath, rules: rules.map(toPublishRuleDto) },
  });

/**
 * Submits a removal request for one already-published folder of a
 * conversation. `path` is the bucket-relative conversation path the publish
 * call uses, not the `conversations/{bucket}/...` resource path. The removal
 * takes effect only after an administrator approves it, so callers must report
 * a pending request rather than a completed removal.
 */
export const unpublishConversation = (
  path: string,
  folderPath: string,
): Promise<UnpublishConversationResultDto> =>
  conversationsApi.unpublishConversation({
    path,
    unpublishConversationDto: { folderPath },
  });

export const getConversationPublishHistory = (
  path: string,
): Promise<PublishConversationResultDto[]> =>
  conversationsApi.getConversationPublishHistory({ path });
