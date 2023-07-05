import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';

import {
  OPENAI_API_HOST,
  OPENAI_API_VERSION,
} from '@/utils/app/const';

import {
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
  fallbackModelID,
  OpenAIEntityType,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';
import { getHeaders } from '@/utils/server/getHeaders';
import { getEntities } from '@/utils/server/getEntities';

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

function limitModelsAccordingToUser(models: OpenAIEntityModel[], session: Session | null) {
  if (!process.env.AVAILABLE_MODELS_USERS_LIMITATIONS) {
    return models;
  }

  const modelsLimitations: Record<string, Set<string>> = (
    process.env.AVAILABLE_MODELS_USERS_LIMITATIONS ?? ''
  )
    .split('|')
    .map((userLimitations) => {
      const [modelId, emailsString] = userLimitations.split('=');
      return {
        modelId,
        emails: new Set(emailsString.split(',')),
      };
    })
    .reduce((acc, curr) => {
      acc[curr.modelId] = curr.emails;

      return acc;
    }, <Record<string, Set<string>>>{});

  models = models.filter((model: OpenAIEntityModel) => {
    if (!modelsLimitations[model.id]) {
      return true;
    }
    if (!session?.user?.email) {
      return false;
    }

    return modelsLimitations[model.id].has(session?.user?.email);
  });
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

    let entities: OpenAIEntityModel[] = [];

    const models = await getEntities('model', key).catch((error) => {
      console.error(error.message);
      return [];
    });
    const applications = await getEntities('application', key).catch((error) => {
      console.error(error.message);
      return [];
    });
    const assistants = await getEntities('assistant', key).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const entity of [...models, ...applications, ...assistants]) {
      entities.push({
        id: entity.id,
        name: OpenAIEntityModels[entity.id as OpenAIEntityModelID]?.name || entity.id,
      } as any);
    }

    entities = limitModelsAccordingToUser(entities, session);
    entities = setDefaultModel(entities);

    return res.status(200).json(entities);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
