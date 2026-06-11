import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { constructPath } from '@/src/utils/app/shared-utils';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { mappingServerUrls } from '@/src/constants/server';

import { getApiHeaders } from './get-headers';
import { logger } from './logger';
import { ServerUtils } from './server';

import { sanitizeUri } from 'micromark-util-sanitize-uri';

const getEntityUrlFromSlugs = ({
  dialApiHost,
  req,
  pathParameter,
  dynamicSlugs,
  apiVersion = 'v1',
}: {
  dialApiHost: string;
  req: NextApiRequest;
  pathParameter?: string;
  dynamicSlugs?: boolean;
  apiVersion?: string;
}) => {
  const slugParam = req.query.slug;
  if (!slugParam) {
    throw new DialAIError(`No path provided`, 400, req);
  }

  const slugs = Array.isArray(slugParam) ? slugParam : [slugParam];
  if (slugs.length === 0) {
    throw new DialAIError(`Empty path provided`, 400, req);
  }

  const defaultPathOptions = dynamicSlugs ? { response: true } : undefined;
  const slugPath = constructPath(ServerUtils.encodeSlugs(slugs));
  const pathOptions = mappingServerUrls[slugPath] ?? defaultPathOptions;
  if (!pathOptions && !dynamicSlugs) {
    throw new DialAIError(`Not found`, 404, req);
  }

  return {
    url: sanitizeUri(
      constructPath(dialApiHost, apiVersion, pathParameter, slugPath),
    ),
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
    dynamicSlugs?: boolean;
    apiVersion?: string;
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
    dynamicSlugs = false,
    apiVersion = 'v1',
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    setTraceparentHeader(res);
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

      const jwt = requireAuth ? await getToken({ req }) : undefined;
      const { url, pathOptions } = getEntityUrlFromSlugs({
        dialApiHost,
        req,
        pathParameter,
        dynamicSlugs,
        apiVersion,
      });

      const reqMethod = method ?? (req.method as HTTPMethod);
      const fetchResult = await fetch(url, {
        method: reqMethod,
        headers: getApiHeaders({ jwt }),
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
        } catch {
          responseData = {};
        }
      }

      return res.status(200).send(responseData);
    } catch (error) {
      logger.error(error);
      return ServerUtils.sendAPIError(res, error);
    }
  };
};
