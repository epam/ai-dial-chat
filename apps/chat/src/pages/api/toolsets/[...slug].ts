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

import { sanitizeUri } from 'micromark-util-sanitize-uri';
import fetch from 'node-fetch';

const getUrlFromReq = (dialApiHost: string, req: NextApiRequest): string => {
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  return constructPath(
    dialApiHost,
    'v1',
    'toolsets',
    ServerUtils.encodeSlugs(slugs),
  );
};

const stringifyBody = (req: NextApiRequest) =>
  typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

const handleRequest = async (req: NextApiRequest) => {
  const token = await getToken({ req });
  const url = getUrlFromReq(process.env.DIAL_API_HOST, req);
  const options = {
    headers: getApiHeaders({ jwt: token?.access_token as string }),
    method: req.method ?? HTTPMethod.GET,
    body: req.body ? stringifyBody(req) : undefined,
  };

  return await fetch(sanitizeUri(url), options);
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  try {
    const proxyRes = await handleRequest(req);

    let json: unknown;
    if (!proxyRes.ok) {
      try {
        json = await proxyRes.json();
      } catch (err) {
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
    if (error instanceof DialAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;
