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

  return (
    constructPath(
      dialApiHost,
      'v1',
      'metadata',
      entityType,
      ServerUtils.encodeSlugs(slugs),
    ) + `?permissions=true`
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  if (!entityType || !isValidEntityApiType(entityType)) {
    return res.status(400).json(errorsMessages.notValidEntityType);
  }

  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const jwt = await getToken({ req });

  try {
    const proxyRes = await fetch(sanitizeUri(url, /^https?$/i), {
      headers: getApiHeaders({ jwt }),
    });

    let json: unknown;
    if (!proxyRes.ok) {
      try {
        json = await proxyRes.json();
      } catch {
        json = undefined;
      }

      throw new DialAIError(
        (typeof json === 'string' && json) || proxyRes.statusText,
        proxyRes.status,
        req,
      );
    }
    json = await proxyRes.json();
    return res.status(200).send(json);
  } catch (error: unknown) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
