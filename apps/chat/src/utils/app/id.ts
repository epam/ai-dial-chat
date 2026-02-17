import {
  isFolderId,
  isMyBucket,
  isMyEntity,
  splitEntityId,
} from '@/src/utils/app/shared-utils';
import { pathKeySeparator } from '@/src/utils/server/api';

import { ApiKeys, FeatureType } from '@/src/types/common';

import { DRAFT_APPLICATION_ID } from '@/src/constants/applications';
import { LOCAL_BUCKET } from '@/src/constants/chat';
import { DRAFT_TOOLSET_ID } from '@/src/constants/toolsets';

import { BucketService } from './data/bucket-service';
import { constructPath } from './file';
import { EnumMapper } from './mappers';

export { isFolderId, isMyBucket, isMyEntity };

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

export const isConversationId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Conversations}/`) ?? false;

export const isPromptId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Prompts}/`) ?? false;

export const isFileId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Files}/`) ?? false;

export const getIdWithoutRootPathSegments = (id: string) =>
  id.split('/').slice(2).join('/');

export const isApplicationId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Applications}/`) ?? false;

export const isToolsetId = (id?: string) =>
  id?.startsWith(`${ApiKeys.Toolsets}/`) ?? false;

export const getApplicationRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.Application, bucket });

export const getToolsetRootId = (bucket?: string) =>
  getRootId({ featureType: FeatureType.Toolset, bucket });

export const getEntityBucket = (entity: { id: string }) =>
  entity.id.split('/')[1];

export const isEntityIdLocal = (entity: { id: string }) =>
  getEntityBucket(entity) === LOCAL_BUCKET;

export const isEntityIdExternal = (entity: { id: string }) => {
  const bucket = getEntityBucket(entity);
  return bucket !== LOCAL_BUCKET && bucket !== BucketService.getBucket();
};

export const isMyApplication = (entity: { id: string }) =>
  entity.id === DRAFT_APPLICATION_ID || isMyEntity(entity);

export const isMyToolset = (entity: { id: string }) =>
  entity.id === DRAFT_TOOLSET_ID || isMyEntity(entity);

export const filterIdsByFeatureType = (
  ids: string[],
  featureType: FeatureType,
) => {
  if (featureType === FeatureType.Chat) {
    return ids.filter(isConversationId);
  } else if (featureType === FeatureType.Prompt) {
    return ids.filter(isPromptId);
  } else if (featureType === FeatureType.Application) {
    return ids.filter(isApplicationId);
  } else if (featureType === FeatureType.File) {
    return ids.filter(isFileId);
  } else if (featureType === FeatureType.Toolset) {
    return ids.filter(isToolsetId);
  }

  return [];
};

export const isPredefinedEntity = (entity: {
  id: string;
  reference?: string;
}) => {
  if (entity.id === entity.reference) return true;
  const [key, bucket] = entity.id.split('/');

  return !Object.values(ApiKeys).includes(key as ApiKeys) || !bucket;
};

export const isRootEntity = (id: string) => {
  return id.split('/').length === 3;
};

export const getIdWithoutFeatureType = (id: string) =>
  id.split('/').slice(1).join('/');

export const areEntitiesBucketsTheSame = (
  firstId: string,
  secondId: string,
) => {
  return getEntityBucket({ id: firstId }) === getEntityBucket({ id: secondId });
};

export const getEntityNameFromId = (
  id: string,
  options?: { removeVersion?: boolean },
): string => {
  const name = id.split('/').at(-1) ?? id;

  if (options?.removeVersion) {
    return name.split(pathKeySeparator).at(0) ?? name;
  }

  return name;
};

export const transformIdToRootEntityId = (id: string) => {
  const { apiKey, name: entityName } = splitEntityId(id);

  return constructPath(
    getRootId({ featureType: EnumMapper.getFeatureTypeByApiKey(apiKey), id }),
    entityName,
  );
};

export const replaceIdWithBucket = (id: string, bucket: string) => {
  const splittedId = id.split('/');
  splittedId[1] = bucket;
  return splittedId.join('/');
};

export const replaceVersionFromId = (id: string, version: string) => {
  const splittedId = id.split(pathKeySeparator);
  return [...splittedId.slice(0, -1), version].join(pathKeySeparator);
};
