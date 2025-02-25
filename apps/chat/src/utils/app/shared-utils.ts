// SHARED UTILS (do not import other utils)
import { Conversation } from '@/src/types/chat';

import { ConversationInfo } from '@epam/ai-dial-shared';

export const isPlaybackConversation = (conversation: ConversationInfo) =>
  (conversation as Conversation).playback?.isPlayback ??
  conversation.isPlayback ??
  false;

export const isReplayConversation = (conversation: ConversationInfo) =>
  (conversation as Conversation).replay?.isReplay ??
  conversation.isReplay ??
  false;

export const isFolderId = (id: string) => id.endsWith('/');

export const isRootId = (id?: string) => {
  return id?.split('/').length === 2;
};
