import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import type { PublishConversationResultDto } from '@epam/ai-dial-chat-api-client';
import { conversationsApi } from './api-client';
import { toPublishRuleDto } from './publish-rules.api';

export const publishConversation = (
  path: string,
  folderPath: string,
  rules: PublicationRule[],
): Promise<PublishConversationResultDto> =>
  conversationsApi.publishConversation({
    path,
    publishConversationDto: { folderPath, rules: rules.map(toPublishRuleDto) },
  });

export const getConversationPublishHistory = (
  path: string,
): Promise<PublishConversationResultDto[]> =>
  conversationsApi.getConversationPublishHistory({ path });
