import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { getEntities } from '@/src/utils/server/get-entities';
import { logger } from '@/src/utils/server/logger';

import { EntityType } from '@/src/types/common';
import { CoreAIEntity, DialAIEntity } from '@/src/types/openai';

import { authOptions } from './auth/[...nextauth]';

// export const config = {
//   runtime: 'edge',
// };

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  try {
    const entities: DialAIEntity[] = [];

    const addons = await getEntities<CoreAIEntity[]>(
      EntityType.Addon,
      token?.access_token as string,
      token?.jobTitle as string,
    ).catch((error) => {
      logger.error(error.message);
      return [];
    });

    for (const addon of addons) {
      entities.push({
        id: addon.id,
        name: addon.display_name ?? addon.id,
        description: addon.description,
        iconUrl: addon.icon_url,
        type: addon.object,
      });
    }

    return res.status(200).json(entities);
  } catch (error) {
    logger.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
