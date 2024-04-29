import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import { ApiKeys } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

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
    throw new DialAIError(`No ${entityType} path provided`, '', '', '400');
  }

  return constructPath(
    dialApiHost,
    'v1',
    'metadata',
    entityType,
    ServerUtils.encodeSlugs(slugs),
  );
};

const isValidEntityApiType = (apiKey: string): boolean => {
  return Object.values(ApiKeys).includes(apiKey as ApiKeys);
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  if (!entityType || !isValidEntityApiType(entityType)) {
    return res.status(400).json(errorsMessages.notValidEntityType);
  }

  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);

  const { recursive = false } = req.query as {
    recursive?: string;
  };

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  const token = await getToken({ req });
  if (!isSessionValid) {
    return;
  }

  try {
    const proxyRes = await fetch(`${url}/?recursive=${recursive}`, {
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    let json: unknown;
    if (!proxyRes.ok) {
      try {
        json = await proxyRes.json();
      } catch (err) {
        json = undefined;
      }

      if (proxyRes.status === 403) {
        return res.status(200).send({ publications: [] });
      }

      throw new DialAIError(
        (typeof json === 'string' && json) || proxyRes.statusText,
        '',
        '',
        proxyRes.status + '',
      );
    }
    json = await proxyRes.json();
    return res.status(200).send(json);
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

export default handler;
