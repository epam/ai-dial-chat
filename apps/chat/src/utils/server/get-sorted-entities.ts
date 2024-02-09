import { JWT } from 'next-auth/jwt';

import { EntityType } from '@/src/types/common';
import {
  OpenAIEntityModel,
  OpenAIEntityModels,
  ProxyOpenAIEntity,
  defaultModelLimits,
  fallbackModelID,
} from '@/src/types/openai';

import { getEntities } from './get-entities';
import { logger } from './logger';

function setDefaultModel(models: OpenAIEntityModel[]) {
  const defaultModelId = process.env.DEFAULT_MODEL || fallbackModelID;
  const defaultModel =
    models.filter((model) => model.id === defaultModelId).pop() || models[0];
  models = models.map((model) =>
    model.id === defaultModel.id ? { ...model, isDefault: true } : model,
  );
  return models;
}

export const getSortedEntities = async (token: JWT | null) => {
  let entities: OpenAIEntityModel[] = [];
  const accessToken = token?.access_token as string;
  const jobTitle = token?.jobTitle as string;
  const models = await getEntities<ProxyOpenAIEntity<EntityType.Model>[]>(
    EntityType.Model,
    accessToken,
    jobTitle,
  ).catch((error) => {
    logger.error(error.message);
    return [];
  });

  const applications = await getEntities<
    ProxyOpenAIEntity<EntityType.Application>[]
  >(EntityType.Application, accessToken, jobTitle).catch((error) => {
    logger.error(error.message);
    return [];
  });
  const assistants = await getEntities<
    ProxyOpenAIEntity<EntityType.Assistant>[]
  >(EntityType.Assistant, accessToken, jobTitle).catch((error) => {
    logger.error(error.message);
    return [];
  });

  for (const entity of [...models, ...applications, ...assistants]) {
    if (
      entity.capabilities?.embeddings ||
      (entity.object === EntityType.Model &&
        entity.capabilities?.chat_completion !== true)
    ) {
      continue;
    }

    const existingModelMapping: OpenAIEntityModel | undefined =
      OpenAIEntityModels[entity.id];

    const maxLength = existingModelMapping
      ? existingModelMapping.maxLength
      : defaultModelLimits.maxLength;

    // applications must handle the limit themselves, because they can have complex logic to handle it
    const fallbackRequestLimit =
      entity.object === EntityType.Application
        ? Infinity
        : defaultModelLimits.requestLimit;

    const requestLimit = existingModelMapping
      ? existingModelMapping.requestLimit
      : fallbackRequestLimit;

    entities.push({
      id: entity.id,
      name: entity.display_name ?? existingModelMapping?.name ?? entity.id,
      description: entity.description,
      iconUrl: entity.icon_url,
      type: entity.object,
      selectedAddons: entity.addons,
      maxLength,
      requestLimit,
      inputAttachmentTypes: entity.input_attachment_types,
      maxInputAttachments: entity.max_input_attachments,
    });
  }

  entities = setDefaultModel(entities);
  return entities;
};
