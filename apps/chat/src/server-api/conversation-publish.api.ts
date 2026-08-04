import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import type { PublishConversationResultDto } from '@epam/chat-api-client';
import { conversationsApi } from './api-client';

export const publishConversation = (
  path: string,
  folderPath: string,
  rules: PublicationRule[],
): Promise<PublishConversationResultDto> =>
  conversationsApi.publishConversation({
    path,
    publishConversationDto: { folderPath, rules },
  });

export const getConversationPublishHistory = (
  path: string,
): Promise<PublishConversationResultDto[]> =>
  conversationsApi.getConversationPublishHistory({ path });
