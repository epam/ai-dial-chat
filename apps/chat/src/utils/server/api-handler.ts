import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import fetch from 'node-fetch';

interface ApiHandlerOptions {
  endpoint: string;
  method?: HTTPMethod;
  returnOriginalResponse?: boolean;
}

export const createApiHandler = ({
  endpoint,
  method = HTTPMethod.POST,
  returnOriginalResponse = true,
}: ApiHandlerOptions) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    setTraceparentHeader(res);
    const session = await getServerSession(req, res, authOptions);
    if (!validateServerSession(session, req, res)) return;

    const jwt = await getToken({ req });

    try {
      const proxyRes = await fetch(`${process.env.DIAL_API_HOST}${endpoint}`, {
        method,
        headers: getApiHeaders({ jwt }),
        ...((method === HTTPMethod.PUT || method === HTTPMethod.POST) &&
          req.body && {
            body: JSON.stringify(req.body),
          }),
      });

      if (!proxyRes.ok) {
        const errorMessage =
          await ServerUtils.getErrorMessageFromResponse(proxyRes);

        throw new DialAIError(
          (typeof errorMessage === 'string' && errorMessage) ||
            proxyRes.statusText,
          proxyRes.status,
          req,
        );
      }

      const responseData = returnOriginalResponse ? await proxyRes.json() : {};
      return res.status(200).send(responseData);
    } catch (error: unknown) {
      logger.error(error);
      return ServerUtils.sendAPIError(res, error);
    }
  };
};
