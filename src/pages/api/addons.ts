import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getEntities } from '@/src/utils/server/get-entities';

import {
  OpenAIEntity,
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityAddons,
  ProxyOpenAIEntity,
} from '@/src/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/src/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }
  const token = await getToken({ req });

  try {
    const entities: OpenAIEntity[] = [];

    const addons: ProxyOpenAIEntity[] = await getEntities(
      'addon',
      token?.access_token as string,
      token?.jobTitle as string,
    ).catch((error) => {
      console.error(error.message);
      return [];
    });

    for (const addon of addons) {
      const mappedAddon: OpenAIEntityAddon | undefined =
        OpenAIEntityAddons[addon.id as OpenAIEntityAddonID];
      entities.push({
        id: addon.id,
        name: addon.display_name ?? mappedAddon?.name ?? addon.id,
        description: addon.description,
        iconUrl: addon.icon_url,
        type: addon.object,
      });
    }

    return res.status(200).json(entities);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
