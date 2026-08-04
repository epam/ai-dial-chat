import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { constructPath } from '@/src/utils/app/file';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { isValidEntityApiType } from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { PublishedItem } from '@/src/types/publication';

import { errorsMessages } from '@/src/constants/errors';

import { sanitizeUri } from 'micromark-util-sanitize-uri';
import fetch from 'node-fetch';

const getEntityUrlFromSlugs = (
  dialApiHost: string,
  req: NextApiRequest,
): string => {
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new DialAIError(`No ${entityType} path provided`, 400, req);
  }

  return constructPath(
    dialApiHost,
    'v1',
    'metadata',
    entityType,
    ServerUtils.encodeSlugs(slugs),
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  if (!entityType || !isValidEntityApiType(entityType)) {
    return res.status(400).json(errorsMessages.notValidEntityType);
  }

  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);

  const { recursive = 'false', limit = '1000' } = req.query as {
    recursive?: string;
    limit?: string;
  };

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const jwt = await getToken({ req });

  const searchParams = new URLSearchParams();
  searchParams.set('recursive', recursive);
  searchParams.set('limit', limit);
  searchParams.set('permissions', 'true');

  try {
    const baseUrl = `${sanitizeUri(url)}/?${searchParams}`;

    const allItems: PublishedItem[] = [];
    let nextToken: string | undefined;
    let json: PublishedItem & { nextToken?: string } = {} as PublishedItem & {
      nextToken?: string;
    };

    do {
      const fetchUrl = nextToken ? `${baseUrl}&token=${nextToken}` : baseUrl;

      const proxyRes = await fetch(fetchUrl, {
        headers: getApiHeaders({ jwt }),
      });

      if (proxyRes.status === 404) {
        break;
      }

      if (!proxyRes.ok) {
        let errorBody: unknown;
        try {
          errorBody = await proxyRes.json();
        } catch {
          errorBody = undefined;
        }

        throw new DialAIError(
          (typeof errorBody === 'string' && errorBody) || proxyRes.statusText,
          proxyRes.status,
          req,
        );
      }

      json = (await proxyRes.json()) as PublishedItem & { nextToken?: string };

      if (json.items) {
        allItems.push(...json.items);
      }

      nextToken = json.nextToken;
    } while (nextToken);

    return res.status(200).send({ ...json, items: allItems });
  } catch (error: unknown) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
