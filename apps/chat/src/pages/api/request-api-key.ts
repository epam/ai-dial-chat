import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    if (
      !process.env.REQUEST_API_KEY_CODE ||
      !process.env.AZURE_FUNCTIONS_API_HOST
    ) {
      logger.error(
        'process.env.REQUEST_API_KEY_CODE or process.env.AZURE_FUNCTIONS_API_HOST not presented',
      );
      throw new DialAIError(errorsMessages.generalServer, 500, req);
    }

    const controller = new AbortController();
    const response = await fetch(
      `${process.env.AZURE_FUNCTIONS_API_HOST}/api/request?code=${process.env.REQUEST_API_KEY_CODE}`,
      {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          ...req.body,
          requester_email: session!.user?.email,
        }),
      },
    );
    if (!response.ok) {
      logger.error(
        `Received error from azure functions: ${response.status} ${
          response.statusText
        } ${await response.text()}`,
      );
      throw new DialAIError(errorsMessages.generalServer, 500, req);
    }

    return res.status(200).send(JSON.stringify({}));
  } catch (error: unknown) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
