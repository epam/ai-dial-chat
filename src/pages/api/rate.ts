import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getApiHeaders } from '../../utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { RateBody } from '../../types/chat';

import { OPENAI_API_HOST } from '@/src/constants/default-settings';
import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import fetch from 'node-fetch';
import { validate } from 'uuid';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (process.env.AUTH_DISABLED !== 'true' && !session) {
    return res.status(401).send(errorsMessages[401]);
  }

  try {
    const { responseId, modelId, value, id } = req.body as RateBody;

    if (!id || !validate(id) || !responseId) {
      return res.status(400).send(errorsMessages[400]);
    }

    const url = `${OPENAI_API_HOST}/v1/rate`;
    const token = await getToken({ req });

    await fetch(url, {
      headers: getApiHeaders({
        chatId: id,
        jwt: token?.access_token as string,
        jobTitle: token?.jobTitle as string,
      }),
      method: 'POST',
      body: JSON.stringify({
        model: modelId,
        rate: value,
        responseId,
      }),
    }).then((r) => r.status);
  } catch (error) {
    logger.error(error);
  }

  return res.status(200).json({});
};

export default handler;
