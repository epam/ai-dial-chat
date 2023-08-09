import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { limitEntitiesAccordingToUser } from '@/utils/server/entitiesPermissions';
import { getEntities } from '@/utils/server/getEntities';

import {
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
  OpenAIEntityModels,
  ProxyOpenAIEntity,
  defaultModelLimits,
  fallbackModelID,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

function setDefaultModel(models: OpenAIEntityModel[]) {
  const defaultModelId = process.env.DEFAULT_MODEL || fallbackModelID;
  const defaultModel =
    models.filter((model) => model.id === defaultModelId).pop() || models[0];
  models = models.map((model) =>
    model.id === defaultModel.id ? { ...model, isDefault: true } : model,
  );
  return models;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  const token = await getToken({ req });

  try {
    const { key } = req.body as {
      key: string;
    };

    let entities: OpenAIEntityModel[] = [];

    const models: ProxyOpenAIEntity<OpenAIEntityModelType>[] =
      await getEntities('model', key, token?.access_token as string).catch(
        (error) => {
          console.error(error.message);
          return [];
        },
      );
    const applications: ProxyOpenAIEntity<OpenAIEntityApplicationType>[] =
      await getEntities(
        'application',
        key,
        token?.access_token as string,
      ).catch((error) => {
        console.error(error.message);
        return [];
      });
    const assistants: ProxyOpenAIEntity<OpenAIEntityAssistantType>[] =
      await getEntities('assistant', key, token?.access_token as string).catch(
        (error) => {
          console.error(error.message);
          return [];
        },
      );

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

    return res.status(200).json(entities);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
