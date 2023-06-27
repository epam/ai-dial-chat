import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';

import { getHeaders } from '../../utils/server/getHeaders';
import {
  BEDROCK_ACCESS,
  BEDROCK_HOST,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '@/utils/app/const';

import {
  OpenAIModel,
  OpenAIModelID,
  OpenAIModels,
  googleModels,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

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

async function getOpenAIModels(session: Session, key: string): Promise<any[]> {
  let url = `${OPENAI_API_HOST}/v1/models`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments?api-version=${OPENAI_API_VERSION}`;
  }

  const errMsg = 'Request for OpenAI models returned an error';

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key ? key : process.env.OPENAI_API_KEY}`,
      }),
      ...(OPENAI_API_TYPE === 'openai' &&
        OPENAI_ORGANIZATION && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
      ...getHeaders(session),
    },
  }).catch((error) => {
    throw new Error(`${errMsg}: ${error.message}`);
  });

  if (response.status !== 200) {
    throw new Error(`${errMsg} ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  return json.data;
}

async function getBedrockModels(session: Session): Promise<any[]> {
  const email = session?.user?.email;

  if (!email) {
    throw new Error('Unknown user');
  }

  if (!BEDROCK_ACCESS.includes(email)) {
    throw new Error('Access denied');
  }

  let url = `${BEDROCK_HOST}/models`;

  const errMsg = 'Request for Bedrock models returned an error';

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...getHeaders(session),
    },
  }).catch((error) => {
    const msg = `${errMsg}: ${error.message}`;
    throw new Error(msg);
  });

  if (response.status !== 200) {
    const msg = `${errMsg} ${response.status}: ${await response.text()}`;
    throw new Error(msg);
  }

  const json = await response.json();
  return json.data;
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).send('');
  }
  try {
    const { key } = req.body as {
      key: string;
    };

    const models: OpenAIModel[] = [];

    const openAIModels = await getOpenAIModels(session, key).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const model of openAIModels) {
      const model_name = OPENAI_API_TYPE === 'azure' ? model.model : model.id;
      for (const [key, value] of Object.entries(OpenAIModelID)) {
        if (value === model_name) {
          models.push({
            id: model.id,
            name: OpenAIModels[value].name,
          } as any);
        }
      }
    }

    if (process.env.GOOGLE_AI_TOKEN) {
      for (const model of googleModels) {
        addModel(model, models);
      }
    }

    const bedrockModels = await getBedrockModels(session).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const model of bedrockModels) {
      addModel(model.id, models);
    }

    // return new Response(JSON.stringify(models), { status: 200 });
    return res.status(200).json(models);
  } catch (error) {
    console.error(error);
    // return new Response('Error', { status: 500 });
    return res.status(500).send('Error');
  }
};

export default handler;
