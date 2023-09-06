import { Session } from 'next-auth';
import { JWT } from 'next-auth/jwt';

import {
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
  OpenAIEntityModels,
  ProxyOpenAIEntity,
  defaultModelLimits,
  fallbackModelID,
} from '@/src/types/openai';

import { limitEntitiesAccordingToUser } from './entities-permissions';
import { getEntities } from './get-entities';

function setDefaultModel(models: OpenAIEntityModel[]) {
  const defaultModelId = process.env.DEFAULT_MODEL || fallbackModelID;
  const defaultModel =
    models.filter((model) => model.id === defaultModelId).pop() || models[0];
  models = models.map((model) =>
    model.id === defaultModel.id ? { ...model, isDefault: true } : model,
  );
  return models;
}

export const getSortedEntities = async (
  token: JWT | null,
  session: Session | null,
) => {
  let entities: OpenAIEntityModel[] = [];
  const accessToken = token?.access_token as string;
  const jobTitle = token?.jobTitle as string;
  const models: ProxyOpenAIEntity<OpenAIEntityModelType>[] = await getEntities(
    'model',
    accessToken,
    jobTitle,
  ).catch((error) => {
    console.error(error.message);
    return [];
  });
  const applications: ProxyOpenAIEntity<OpenAIEntityApplicationType>[] =
    await getEntities('application', accessToken, jobTitle).catch((error) => {
      console.error(error.message);
      return [];
    });
  const assistants: ProxyOpenAIEntity<OpenAIEntityAssistantType>[] =
    await getEntities('assistant', accessToken, jobTitle).catch((error) => {
      console.error(error.message);
      return [];
    });

  for (const entity of [...models, ...applications, ...assistants]) {
    if (
      entity.capabilities?.embeddings ||
      (entity.object === 'model' &&
        entity.capabilities?.chat_completion !== true)
    ) {
      continue;
    }

    const existingModelMapping: OpenAIEntityModel | undefined =
      OpenAIEntityModels[entity.id];

    entities.push({
      id: entity.id,
      name: entity.display_name ?? existingModelMapping?.name ?? entity.id,
      description: entity.description,
      iconUrl: entity.icon_url,
      type: entity.object,
      selectedAddons: entity.addons,
      ...(existingModelMapping
        ? {
            maxLength: existingModelMapping.maxLength,
            requestLimit: existingModelMapping.requestLimit,
          }
        : defaultModelLimits),
    });
  }

  entities = limitEntitiesAccordingToUser(
    entities,
    session,
    process.env.AVAILABLE_MODELS_USERS_LIMITATIONS,
  );
  entities = setDefaultModel(entities);
  return entities;
};
