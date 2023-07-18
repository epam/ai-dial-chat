import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { limitEntitiesAccordingToUser } from '@/utils/server/entitiesPermissions';
import { getEntities } from '@/utils/server/getEntities';

import {
  OpenAIEntity,
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityAddons,
  ProxyOpenAIEntity,
} from '@/types/openai';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

// export const config = {
//   runtime: 'edge',
// };

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

    const addons: ProxyOpenAIEntity[] = await getEntities('addon', key).catch(
      (error) => {
        console.error(error.message);
        return [];
      },
    );

    for (const addon of addons) {
      const mappedAddon: OpenAIEntityAddon | undefined =
        OpenAIEntityAddons[addon.id as OpenAIEntityAddonID];
      entities.push({
        id: addon.id,
        name: mappedAddon?.name || addon.id,
        type: addon.object,
      });
    }

    entities = limitEntitiesAccordingToUser(
      entities,
      session,
      process.env.AVAILABLE_ADDONS_USERS_LIMITATIONS,
    );

    return res.status(200).json(entities);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
