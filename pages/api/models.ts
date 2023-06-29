import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';

import { getOpenAIHeaders } from '../../utils/server/getHeaders';
import {
  BEDROCK_HOST,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
} from '@/utils/app/const';

import {
  OpenAIModel,
  OpenAIModelID,
  OpenAIModels,
  googleModels,
  fallbackModelID,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

function addModel(model_name: string, models: OpenAIModel[]) {
  for (const [key, value] of Object.entries(OpenAIModelID)) {
    if (value === model_name) {
      models.push({
        id: model_name,
        name: OpenAIModels[value].name,
      } as any);
    }
  }
}

async function getOpenAIModels(session: Session | null, key: string): Promise<any[]> {
  let url = `${OPENAI_API_HOST}/v1/models`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments?api-version=${OPENAI_API_VERSION}`;
  }

  const errMsg = 'Request for OpenAI models returned an error';

  const response = await fetch(url, {
    headers: getOpenAIHeaders(session, key),
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return json.data;
}

async function getBedrockModels(session: Session | null, key: string): Promise<any[]> {
  const email = session?.user?.email;

  if (!email) {
    throw new Error('Unknown user');
  }

  let url = `${BEDROCK_HOST}/openai/models`;

  const errMsg = 'Request for Bedrock models returned an error';

  const response = await fetch(url, {
    headers: getOpenAIHeaders(session, key)
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return json.data;
}

function setDefaultModel(models: OpenAIModel[]) {
  const defaultModelId = process.env.DEFAULT_MODEL || fallbackModelID;
  const defaultModel =
    models.filter((model) => model.id === defaultModelId).pop() || models[0];
  models = models.map((model) =>
    model.id === defaultModel.id ? { ...model, isDefault: true } : model,
  );
  return models;
}

function limitModelsAccordingToUser(models: OpenAIModel[], session: Session | null) {
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

  models = models.filter((model: OpenAIModel) => {
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

    let models: OpenAIModel[] = [];

    const openAIModels = await getOpenAIModels(session, key).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const model of openAIModels) {
      const model_name = OPENAI_API_TYPE === 'azure' ? model.model : model.id;
      addModel(model_name, models);
    }

    if (process.env.GOOGLE_AI_TOKEN) {
      for (const model of googleModels) {
        addModel(model, models);
      }
    }

    const bedrockModels = await getBedrockModels(session, key).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const model of bedrockModels) {
      addModel(model.id, models);
    }

    models = limitModelsAccordingToUser(models, session);
    models = setDefaultModel(models);

    // return new Response(JSON.stringify(models), { status: 200 });
    return res.status(200).json(models);
  } catch (error) {
    console.error(error);
    // return new Response('Error', { status: 500 });
    return res.status(500).send('Error');
  }
};

export default handler;
