import type { PublishConversationResultDto } from '@epam/chat-api-client';
import { conversationsApi } from './api-client';

export const publishConversation = (
  path: string,
  folderPath: string,
): Promise<PublishConversationResultDto> =>
  conversationsApi.publishConversation({
    path,
    publishConversationDto: { folderPath },
  });

export const getConversationPublishHistory = (
  path: string,
): Promise<PublishConversationResultDto[]> =>
  conversationsApi.getConversationPublishHistory({ path });
