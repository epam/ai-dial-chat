import { getModelIdWithoutVersion } from '@/src/utils/server/api';

import { ApplicationStatus } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import {
  DialAIEntity,
  DialAIEntityModel,
  ModelsGroup,
  ModelsMap,
} from '@/src/types/models';

import { constructPath } from './file';

import { Conversation, Role } from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';
import omit from 'lodash-es/omit';
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

export const getGroupModelKey = (model: DialAIEntityModel) => {
  if (model.id === model.reference) {
    return model.name;
  }
  const pathParts = getModelIdWithoutVersion(model.id).split('/');
  const bucket = pathParts.slice(0, 2); // type and bucket
  const name = pathParts.slice(-1); // name
  return constructPath(...bucket, ...name); // ignore public folder as result
};

export const groupModelsAndSaveOrder = (
  models: DialAIEntityModel[],
): ModelsGroup[] => {
  const uniqModels = uniqBy(models, 'reference');
  const groupedModels = groupBy(uniqModels, getGroupModelKey);
  const insertedSet = new Set();
  const result: ModelsGroup[] = [];

  uniqModels.forEach((model) => {
    const key = getGroupModelKey(model);
    if (!insertedSet.has(key)) {
      result.push({ groupName: key, entities: groupedModels[key] });
      insertedSet.add(key);
    }
  });

  return result;
};

export const addToModelsMap = (
  modelsMap: ModelsMap,
  ...models: DialAIEntityModel[]
) => {
  models.forEach((model) => {
    modelsMap[model.id] = model;
    if (model.id !== model.reference) {
      modelsMap[model.reference] = model;
    }
  });
  return modelsMap;
};

export const deleteFromModelsMap = (modelsMap: ModelsMap, ...ids: string[]) => {
  const model = ids.map((id) => modelsMap[id]).filter(Boolean)[0];
  if (model) {
    return omit(modelsMap, model.reference, model.id);
  }
  return modelsMap;
};

export const checkIsNotAllowedModelUtil = (
  conv: Conversation,
  modelsMap: ModelsMap,
): boolean => {
  if (
    !!conv.replay?.isReplay &&
    conv.replay?.replayAsIs &&
    conv.replay?.replayUserMessagesStack &&
    conv.replay.replayUserMessagesStack.length > 0 &&
    conv.replay.replayUserMessagesStack[0].model
  ) {
    return conv.replay.replayUserMessagesStack.some(
      (message) =>
        message.role === Role.User &&
        message.model?.id &&
        !modelsMap[message.model.id],
    );
  }

  if (!conv.model || !conv.model.id) {
    return true;
  }

  const modelInMap = modelsMap[conv.model.id] as DialAIEntityModel | undefined;

  if (!modelInMap) {
    return true;
  }

  const isNotDeployedCustomApp =
    modelInMap.type === EntityType.Application &&
    modelInMap.functionStatus &&
    modelInMap.functionStatus !== ApplicationStatus.DEPLOYED;

  if (isNotDeployedCustomApp) {
    return true;
  }

  if (
    modelInMap.type === EntityType.Assistant &&
    conv.assistantModelId &&
    !modelsMap[conv.assistantModelId]
  ) {
    return true;
  }

  return false;
};
