import { getModelIdWithoutVersion } from '@/src/utils/server/api';

import {
  EntitiesGroup,
  MarketplaceEditorSteps,
  MarketplaceEntity,
} from '@/src/types/marketplace';

import { constructPath } from './shared-utils';

import { groupBy, omit, uniqBy } from 'lodash-es';

export const getGroupMarketplaceEntityKey = (entity: MarketplaceEntity) => {
  if (entity.id === entity.reference) {
    return entity.name;
  }
  const pathParts = getModelIdWithoutVersion(entity.id).split('/');
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
