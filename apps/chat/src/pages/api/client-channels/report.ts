import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';
import { HeadersNames } from '@/src/constants/server';

const host = process.env.DIAL_API_HOST;

const URL = `${host}/v1/ops/client-channel/report`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== HTTPMethod.POST) {
    res.setHeader('Allow', HTTPMethod.POST);
    return res.status(400).send(errorsMessages[400]);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const jwt = await getToken({ req });
    const channelId = req.headers[HeadersNames.X_DIAL_CLIENT_CHANNEL_ID] as
      | string
      | undefined;

    if (!channelId) {
      throw new DialAIError(
        `Missing ${HeadersNames.X_DIAL_CLIENT_CHANNEL_ID} header`,
        400,
        req,
      );
    }

    const response = await fetch(URL, {
      method: HTTPMethod.POST,
      headers: {
        'Content-Type': 'application/json',
        ...getApiHeaders({ jwt }),
        [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: channelId,
      },
      body: JSON.stringify(req.body),
    });

    let json: unknown;

    if (!response.ok) {
      json = await ServerUtils.getErrorMessageFromResponse(response);
      throw new DialAIError(
        (typeof json === 'string' && json) || errorsMessages.generalServer,
        response.status,
        req,
      );
    }

    json = await response.json();

    return res.status(200).send(json);
  } catch (error) {
    logger.error(error);
    if (error instanceof DialAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;
