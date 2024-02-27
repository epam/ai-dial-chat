import { ApiKeys, FeatureType } from '@/src/types/common';

import { BucketService } from './data/bucket-service';
import { constructPath } from './file';
import { splitEntityId } from './folders';
import { EnumMapper } from './mappers';

export const getRootId = ({
  id,
  featureType = FeatureType.File,
  bucket,
}: {
  id?: string;
  featureType?: FeatureType;
  bucket?: string;
} = {}) => {
  const splittedEntityId = id ? splitEntityId(id) : undefined;

  return constructPath(
    splittedEntityId?.apiKey ?? EnumMapper.getApiKeyByFeatureType(featureType),
    splittedEntityId?.bucket ?? bucket ?? BucketService.getBucket(),
  );
};

export const getConversationRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.Chat, bucket });

export const getPromptRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.Prompt, bucket });

export const isRootId = (id?: string) => {
  return id?.split('/').length === 2 || false;
};

export const isRootConversationsId = (id?: string) =>
  isRootId(id) && id?.startsWith(`${ApiKeys.Conversations}/`);

export const isRootPromptId = (id?: string) =>
  isRootId(id) && id?.startsWith(`${ApiKeys.Prompts}/`);

export const isFolderId = (id: string) => id.endsWith('/');
