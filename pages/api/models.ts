import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';

import { limitEntitiesAccordingToUser } from '@/utils/server/entitiesPermissions';
import { getEntities } from '@/utils/server/getEntities';

import {
  OpenAIEntity,
  OpenAIEntityAddonID,
  OpenAIEntityModelID,
  OpenAIEntityModels,
  ProxyOpenAIEntity,
  fallbackModelID,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

function setDefaultModel(models: OpenAIEntity[]) {
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

  try {
    const { key } = req.body as {
      key: string;
    };

    let entities: OpenAIEntity[] = [];

    const models: ProxyOpenAIEntity[] = await getEntities('model', key).catch(
      (error) => {
        console.error(error.message);
        return [];
      },
    );
    const applications: ProxyOpenAIEntity[] = await getEntities(
      'application',
      key,
    ).catch((error) => {
      console.error(error.message);
      return [];
    });
    const assistants: ProxyOpenAIEntity[] = await getEntities(
      'assistant',
      key,
    ).catch((error) => {
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

      const existingModelMapping =
        OpenAIEntityModels[entity.id as OpenAIEntityModelID];
      if (existingModelMapping != null) {
        entities.push({
          id: entity.id,
          name: existingModelMapping.name,
          type: entity.object,
          selectedAddons: entity.addons as OpenAIEntityAddonID[] | undefined,
        });
      }
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
