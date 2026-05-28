import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';
import { HeadersNames } from '@/src/constants/server';

const host = process.env.DIAL_API_HOST;

const URL = `${host}/v1/ops/client-channel/unsubscribe`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }
  let channelId = req.headers[HeadersNames.X_DIAL_CLIENT_CHANNEL_ID] as
    | string
    | undefined;
  try {
    if (!channelId) {
      channelId = JSON.parse(req.body)?.channelId as string;
    }
  } catch {
    channelId = undefined;
  }

  try {
    const jwt = await getToken({ req });

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
        ...getApiHeaders({ jwt }),
        [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: channelId,
      },
    });

    if (!response.ok) {
      const errorText = await ServerUtils.getErrorMessageFromResponse(response);
      throw new DialAIError(
        errorText || errorsMessages.generalServer,
        response.status,
        req,
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
