import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

const getEntityUrlFromSlugs = (dialApiHost: string, req: NextApiRequest) => {
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new DialAIError('No path provided', '', '', '400');
  }

  return constructPath(
    dialApiHost,
    'v1',
    'deployments',
    ServerUtils.encodeSlugs(slugs),
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);
  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  try {
    const proxyRes = await fetch(url, {
      method: HTTPMethod.GET,
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    if (!proxyRes.ok) {
      throw new DialAIError(
        'Deployments request failed',
        '',
        '',
        String(proxyRes.status),
      );
    }
    let json: unknown;
    try {
      json = await proxyRes.json();
    } catch {
      json = {};
    }

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
