// SHARED UTILS (do not import other utils)
import { Conversation } from '@/src/types/chat';

import { ROOT_SECTION_NAME } from '@/src/constants/sections';

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

export const constructPath = (
  ...values: (string | undefined | null)[]
): string => {
  const path = values.filter(Boolean).join('/');
  return path.startsWith('api/') ? path.replace('api/', '/api/') : path;
};

// {apikey}/{bucket}/path.../name
export const splitEntityId = (
  id: string,
): {
  bucket: string;
  name: string;
  parentPath: string | undefined;
  apiKey: string;
  isRoot: boolean;
} => {
  const parts = id.split('/');
  const parentPath =
    parts.length > 3
      ? constructPath(...parts.slice(2, parts.length - 1))
      : undefined;

  const isRoot = parts.length < 3;

  const name = isRoot ? ROOT_SECTION_NAME : parts[parts.length - 1];

  return {
    apiKey: parts[0],
    bucket: parts[1],
    parentPath,
    name,
    isRoot,
  };
};
