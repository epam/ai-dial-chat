// SHARED UTILS (do not import other utils)
import { Conversation } from '@/src/types/chat';
import { ApiKeys } from '@/src/types/common';

import { LOCAL_BUCKET } from '@/src/constants/chat';
import { ROOT_SECTION_NAME } from '@/src/constants/sections';

import { BucketService } from './data/bucket-service';

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

export const constructPath = (
  ...values: (string | undefined | null)[]
): string => {
  const path = values.filter(Boolean).join('/');
  return path.startsWith('api/') ? path.replace('api/', '/api/') : path;
};

// {apikey}/{bucket}/path.../name
export const splitEntityId = (
  id: string,
  forceUseNameFromId?: boolean,
  rootSectionName = ROOT_SECTION_NAME,
): {
  bucket: string;
  name: string;
  parentPath: string | undefined;
  apiKey: ApiKeys;
  isRoot: boolean;
} => {
  const parts = id.split('/');
  const parentPath =
    parts.length > 3
      ? constructPath(...parts.slice(2, parts.length - 1))
      : undefined;

  const isRoot = parts.length < 3;

  const name =
    isRoot && !forceUseNameFromId ? rootSectionName : parts[parts.length - 1];

  return {
    apiKey: parts[0] as ApiKeys,
    bucket: parts[1],
    parentPath,
    name,
    isRoot,
  };
};

export const getEntityBucket = (entity: { id: string }) =>
  entity.id.split('/')[1];

export const isMyBucket = (bucket: string) => {
  return bucket === LOCAL_BUCKET || bucket === BucketService.getBucket();
};

export const isMyEntity = (entity: { id: string }) =>
  isMyBucket(getEntityBucket(entity));
