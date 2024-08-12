import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getApiHeaders } from '../../utils/server/get-headers';
import { validateServerSession } from '@/src/utils/auth/session';
import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';
import { logger } from '@/src/utils/server/logger';

import { RateBody } from '../../types/chat';
import { HTTPMethod } from '@/src/types/http';

import { DIAL_API_HOST } from '@/src/constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const { responseId, modelId, value, id } = req.body as RateBody;

    if (!id || !responseId || !modelId) {
      return res.status(400).send(errorsMessages[400]);
    }

    const token = await getToken({ req });

    const entities = await getSortedEntities(token);
    if (!entities.some((entity) => entity.id === modelId)) {
      throw new Error(`Rated model not exists - ${modelId}`);
    }

    const url = `${DIAL_API_HOST}/v1/${modelId}/rate`;

    await fetch(url, {
      headers: getApiHeaders({
        chatId: id,
        jwt: token?.access_token as string,
        jobTitle: token?.jobTitle as string,
      }),
      method: HTTPMethod.POST,
      body: JSON.stringify({
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
