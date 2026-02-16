import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { getToken } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const jwt = await getToken({ req });

    const url = `${process.env.DIAL_API_HOST}/v1/bucket`;
    const response = await fetch(url, {
      headers: getApiHeaders({
        jwt,
      }),
    });

    if (!response.ok) {
      const serverErrorMessage = await response.text();
      throw new DialAIError(serverErrorMessage, response.status, req);
    }

    const json = (await response.json()) as { bucket: string };

    return res.status(200).send(json);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
