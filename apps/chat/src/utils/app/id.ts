import { ApiKeys, FeatureType } from '@/src/types/common';

import { BucketService } from './data/bucket-service';
import { constructPath } from './file';
import { splitEntityId } from './folders';
import { EnumMapper } from './mappers';

export const getRootId = ({
  featureType,
  id,
  bucket,
}: {
  featureType: FeatureType;
  id?: string;
  bucket?: string;
}) => {
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

export const getFileRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.File, bucket });

export const isRootId = (id?: string) => {
  return id?.split('/').length === 2;
};

export const isRootConversationsId = (id?: string) =>
  isRootId(id) && isConversationId(id);

export const isRootPromptId = (id?: string) => isRootId(id) && isPromptId(id);

export const isFolderId = (id: string) => id.endsWith('/');

export const isConversationId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Conversations}/`);

export const isPromptId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Prompts}/`);

export const isFileId = (id?: string) => id?.startsWith(`${ApiKeys.Files}/`);

export const getIdWithoutRootPathSegments = (id: string) =>
  id.split('/').slice(2).join('/');

export const isApplicationId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Applications}/`);

export const getApplicationRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.Application, bucket });

export const isEntityIdExternal = (entity: { id: string }) =>
  entity.id.split('/')[1] !== BucketService.getBucket();
