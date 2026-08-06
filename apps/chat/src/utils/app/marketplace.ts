import {
  getApplicationMcpUrl,
  isDialAiEntityModel,
} from '@/src/utils/app/application';
import { getLocalizedEntityIdName } from '@/src/utils/app/marketplace-localization';
import { getToolsetMcpUrl } from '@/src/utils/app/toolsets';
import {
  getModelIdWithoutVersion,
  pathKeySeparator,
} from '@/src/utils/server/api';

import {
  EntitiesGroup,
  MarketplaceEditorSteps,
  MarketplaceEntity,
} from '@/src/types/marketplace';

import { NA_VERSION } from '@/src/constants/publication';

import { constructPath } from './shared-utils';

import groupBy from 'lodash-es/groupBy';
import omit from 'lodash-es/omit';
import uniqBy from 'lodash-es/uniqBy';

const isNaVersionSegment = (segment: string) => {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // keep the raw value if it is not a valid URI component
  }
  const normalized = decoded.toLowerCase();
  return normalized === NA_VERSION.toLowerCase() || normalized === 'na';
};

const stripNaVersion = (id: string) => {
  const separatorIndex = id.lastIndexOf(pathKeySeparator);
  if (separatorIndex === -1) {
    return id;
  }

  const versionPart = id.slice(separatorIndex + pathKeySeparator.length);
  return isNaVersionSegment(versionPart) ? id.slice(0, separatorIndex) : id;
};

export const getGroupMarketplaceEntityKey = (entity: MarketplaceEntity) => {
  if (!isCreatedMarketplaceEntity(entity)) {
    return getLocalizedEntityIdName(entity.name);
  }
  const pathParts = getModelIdWithoutVersion(stripNaVersion(entity.id)).split(
    '/',
  );
  const bucket = pathParts.slice(0, 2); // type and bucket
  const name = pathParts.slice(-1); // name
  return constructPath(...bucket, ...name); // ignore public folder as result
};

export const groupMarketplaceEntityAndSaveOrder = <T extends MarketplaceEntity>(
  entity: T[],
): EntitiesGroup<T>[] => {
  const uniqEntities = uniqBy(entity, 'reference');
  const groupedEntities = groupBy(uniqEntities, getGroupMarketplaceEntityKey);
  const insertedSet = new Set();
  const result: EntitiesGroup<T>[] = [];

  uniqEntities.forEach((entity) => {
    const key = getGroupMarketplaceEntityKey(entity);
    if (!insertedSet.has(key)) {
      result.push({ groupName: key, entities: groupedEntities[key] });
      insertedSet.add(key);
    }
  });

  return result;
};

export const addToMarketplaceEntitiesMap = <T extends MarketplaceEntity>(
  entitiesMap: Partial<Record<string, T>>,
  ...entities: T[]
) => {
  entities.forEach((entity) => {
    entitiesMap[entity.id] = entity;
    if (entity.id !== entity.reference) {
      entitiesMap[entity.reference] = entity;
    }
  });
  return entitiesMap;
};

export const deleteFromMarketplaceEntitiesMap = <
  T extends Partial<Record<string, MarketplaceEntity>>,
>(
  entitiesMap: T,
  ...ids: string[]
) => {
  const entity = ids.map((id) => entitiesMap[id]).filter(Boolean)[0];
  if (entity) {
    return omit(entitiesMap, entity.reference, entity.id);
  }
  return entitiesMap;
};

export const isMarketplaceEditorStep = (
  step: string,
): step is MarketplaceEditorSteps => {
  return (
    step === MarketplaceEditorSteps.General ||
    step === MarketplaceEditorSteps.Settings
  );
};

export const isCreatedMarketplaceEntity = (
  entity: MarketplaceEntity,
): boolean => {
  return entity.id !== entity.reference;
};

export const getMarketplaceEntityMcpUrl = (entity: MarketplaceEntity) => {
  if (isDialAiEntityModel(entity)) return getApplicationMcpUrl(entity.id);
  else return getToolsetMcpUrl(entity.id);
};
