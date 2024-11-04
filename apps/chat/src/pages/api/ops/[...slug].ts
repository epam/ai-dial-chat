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

import fetch from 'node-fetch';

const getEntityUrlFromSlugs = (
  dialApiHost: string,
  req: NextApiRequest,
): string => {
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new DialAIError(`No path provided`, '', '', '400');
  }

  return constructPath(
    dialApiHost,
    'v1',
    'ops',
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
    const opsRes = await fetch(url, {
      method: HTTPMethod.POST,
      headers: getApiHeaders({ jwt: token?.access_token as string }),
      body: JSON.stringify(req.body),
    });

    if (!opsRes.ok) {
      throw new DialAIError(`Operation failed`, '', '', opsRes.status + '');
    }
    let json: unknown;
    try {
      json = await opsRes.json();
    } catch (err) {
      json = {};
    }
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
