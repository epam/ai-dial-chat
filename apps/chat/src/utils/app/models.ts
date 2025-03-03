import { EntityType } from '@/src/types/common';
import { DialAIEntity, DialAIEntityModel } from '@/src/types/models';

import { getModelIdWithoutVersion } from '../server/api';

import groupBy from 'lodash-es/groupBy';
import uniqBy from 'lodash-es/uniqBy';

export const doesModelAllowSystemPrompt = (
  model: DialAIEntityModel | undefined,
) => !!model?.features?.systemPrompt;

export const doesModelAllowTemperature = (
  model: DialAIEntityModel | undefined,
) => !!model?.features?.temperature;

export const doesModelAllowAddons = (model: DialAIEntityModel | undefined) =>
  !!model?.features?.addons;

export const doesModelHaveSettings = (model: DialAIEntityModel | undefined) => {
  return (
    model &&
    model.type !== EntityType.Application && // custom settings in future
    (model.type === EntityType.Assistant ||
      doesModelAllowSystemPrompt(model) ||
      doesModelAllowTemperature(model) ||
      doesModelAllowAddons(model))
  );
};

export const doesModelHaveConfiguration = (model?: DialAIEntity): boolean => {
  return !!model?.features?.configuration;
};

interface ModelGroup {
  groupName: string;
  entities: DialAIEntityModel[];
}

export const getGroupModelKey = (model: DialAIEntityModel) =>
  model.id === model.reference
    ? model.name
    : getModelIdWithoutVersion(model.id);

export const groupModelsAndSaveOrder = (
  models: DialAIEntityModel[],
): ModelGroup[] => {
  const uniqModels = uniqBy(models, 'reference');
  const groupedModels = groupBy(uniqModels, getGroupModelKey);
  const insertedSet = new Set();
  const result: ModelGroup[] = [];

  uniqModels.forEach((model) => {
    const key = getGroupModelKey(model);
    if (!insertedSet.has(key)) {
      result.push({ groupName: key, entities: groupedModels[key] });
      insertedSet.add(key);
    }
  });

  return result;
};
