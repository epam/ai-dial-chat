import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { getHeaders } from '../../utils/server/getHeaders';
import {
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '@/utils/app/const';

import { OpenAIModel, OpenAIModelID, OpenAIModels } from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

// export const config = {
//   runtime: 'edge',
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);

  if (process.env.AUTH_ENABLED && !session) {
    return res.status(401).send('');
  }
  try {
    const { key } = req.body as {
      key: string;
    };

    let url = `${OPENAI_API_HOST}/v1/models`;
    if (OPENAI_API_TYPE === 'azure') {
      url = `${OPENAI_API_HOST}/openai/deployments?api-version=${OPENAI_API_VERSION}`;
    }
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
        ...((session && getHeaders(session)) || {}),
      },
    });
    const models: OpenAIModel[] = [];

    if (response.status !== 200) {
      console.error(
        `OpenAI API returned an error ${
          response.status
        }: ${await response.text()}`,
      );
      // throw new Error('OpenAI API returned an error');
    } else {
      const json = await response.json();

      const openAIModels = json.data
        .map((model: any) => {
          const model_name =
            OPENAI_API_TYPE === 'azure' ? model.model : model.id;
          for (const [key, value] of Object.entries(OpenAIModelID)) {
            if (value === model_name) {
              return {
                id: model.id,
                name: OpenAIModels[value].name,
              };
            }
          }
        })
        .filter(Boolean);
      models.push(...openAIModels);
    }

    if (process.env.GOOGLE_AI_TOKEN) {
      models.push({
        id: OpenAIModels[OpenAIModelID.BISON_001].id,
        name: OpenAIModels[OpenAIModelID.BISON_001].name,
      } as any);
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
