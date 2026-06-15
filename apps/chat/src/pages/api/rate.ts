import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { ApiUtils } from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';
import { logger } from '@/src/utils/server/logger';
import { getFullToken } from '@/src/utils/server/server';

import { RateBody } from '@/src/types/chat';
import { HTTPMethod } from '@/src/types/http';

import { DIAL_API_HOST } from '@/src/constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const { responseId, modelId, value, id, reference, comment } =
      req.body as RateBody;

    if (!id || !responseId || !modelId) {
      return res.status(400).send(errorsMessages[400]);
    }

    const token = await getFullToken({ req });

    const { entities } = await getSortedEntities(
      token?.token ?? '',
      token?.jobTitle ?? '',
    );
    const model = entities.find(
      (entity) => entity.id === modelId || entity.reference === modelId,
    );
    if (!model) {
      throw new Error(`Rated model not exists - ${modelId}`);
    }

    const url = `${DIAL_API_HOST}/v1/${ApiUtils.encodeApiUrl(model.id)}/rate`;

    await fetch(url, {
      headers: getApiHeaders({
        chatReference: reference ?? id,
        jwt: token?.token as string,
        jobTitle: token?.jobTitle as string,
      }),
      method: HTTPMethod.POST,
      body: JSON.stringify({
        rate: value,
        modelId: model.id,
        conversationId: id,
        conversationReference: reference,
        responseId,
        ...(comment && { comment }),
      }),
    }).then((r) => r.status);
  } catch (error) {
    logger.error('Failed to rate message:' + error);
    return res.status(500).send(errorsMessages.generalServer);
  }

  return res.status(200).json({});
};

export default handler;
