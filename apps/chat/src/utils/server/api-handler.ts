import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

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
    const session = await getServerSession(req, res, authOptions);
    if (!validateServerSession(session, req, res)) return;

    const token = await getToken({ req });

    try {
      const proxyRes = await fetch(`${process.env.DIAL_API_HOST}${endpoint}`, {
        method,
        headers: getApiHeaders({ jwt: token?.access_token as string }),
        body: JSON.stringify(req.body),
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
      if (error instanceof DialAIError) {
        return res
          .status(parseInt(error.code, 10) || 500)
          .send(error.message || errorsMessages.generalServer);
      }
      return res.status(500).send(errorsMessages.generalServer);
    }
  };
};
