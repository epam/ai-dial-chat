import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/src/constants/errors';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  const token = await getToken({ req });

  try {
    const entities = await getSortedEntities(token);

    return res.status(200).json(entities);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error');
  }
};

export default handler;
