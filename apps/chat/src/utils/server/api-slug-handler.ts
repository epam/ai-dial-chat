import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { constructPath } from '@/src/utils/app/shared-utils';
import { validateServerSession } from '@/src/utils/auth/session';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';
import { mappingServerUrls } from '@/src/constants/server';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import { getApiHeaders } from './get-headers';
import { logger } from './logger';
import { ServerUtils } from './server';

import { sanitizeUri } from 'micromark-util-sanitize-uri';

export const getEntityUrlFromSlugs = ({
  dialApiHost,
  req,
  pathParameter,
}: {
  dialApiHost: string;
  req: NextApiRequest;
  pathParameter?: string;
}) => {
  const slugParam = req.query.slug;
  if (!slugParam) {
    throw new DialAIError(`No path provided`, 400, req);
  }

  const slugs = Array.isArray(slugParam) ? slugParam : [slugParam];
  if (slugs.length === 0) {
    throw new DialAIError(`Empty path provided`, 400, req);
  }

  const slugPath = constructPath(ServerUtils.encodeSlugs(slugs));
  const pathOptions = mappingServerUrls[slugPath];
  if (!pathOptions) {
    throw new DialAIError(`Not found`, 404, req);
  }

  return {
    url: sanitizeUri(constructPath(dialApiHost, 'v1', pathParameter, slugPath)),
    pathOptions,
  };
};

//slugs handler factory
export const createDialApiSlugsHandler = (
  options: {
    requireAuth?: boolean;
    method?: HTTPMethod;
    allowedMethods?: HTTPMethod[];
    dialApiHost?: string;
    timeout?: number;
    generalErrorMessage?: string;
    pathParameter?: string;
  } = {},
) => {
  const {
    requireAuth = true,
    method,
    allowedMethods = [
      HTTPMethod.GET,
      HTTPMethod.POST,
      HTTPMethod.PUT,
      HTTPMethod.DELETE,
    ],
    dialApiHost = process.env.DIAL_API_HOST,
    timeout = 30000, // 30 seconds default
    generalErrorMessage,
    pathParameter,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method validation
    if (
      (method && req.method !== method) ||
      !allowedMethods.includes(req.method as HTTPMethod)
    ) {
      logger.warn(`Method ${req.method} not allowed for this endpoint`);
      return res.status(405).send(`Method ${req.method} Not Allowed`);
    }

    try {
      // Authentication if required
      if (requireAuth) {
        const session = await getServerSession(req, res, authOptions);
        const isSessionValid = validateServerSession(session, req, res);
        if (!isSessionValid) return;
      }

      const token = requireAuth ? await getToken({ req }) : null;
      const { url, pathOptions } = getEntityUrlFromSlugs({
        dialApiHost,
        req,
        pathParameter,
      });

      const reqMethod = method ?? (req.method as HTTPMethod);
      const fetchResult = await fetch(url, {
        method: reqMethod,
        headers: getApiHeaders({ jwt: token?.access_token as string }),
        body:
          reqMethod !== HTTPMethod.GET ? JSON.stringify(req.body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });

      if (!fetchResult.ok) {
        const errorMessage =
          await ServerUtils.getErrorMessageFromResponse(fetchResult);

        throw new DialAIError(
          (typeof errorMessage === 'string' && errorMessage) ||
            generalErrorMessage ||
            fetchResult.statusText,
          fetchResult.status,
          req,
        );
      }

      let responseData = {};
      if (pathOptions.response) {
        try {
          responseData = await fetchResult.json();
        } catch (err) {
          responseData = {};
        }
      }

      return res.status(200).send(responseData);
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
};
