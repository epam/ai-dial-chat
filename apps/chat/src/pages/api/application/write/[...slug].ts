// pages/api/metadata/applications/[slug].ts
import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

// You'll provide the correct paths for your project structure
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler: NextApiHandler = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const session = await getServerSession(req, res, authOptions);
  const isValidSession = validateServerSession(session, req, res);

  if (!isValidSession) {
    return;
  }

  const token = await getToken({ req, secret: process.env.JWT_SECRET });

  const urlSlug = Array.isArray(req.query.slug)
    ? req.query.slug.join('/')
    : req.query.slug;

  try {
    const proxyRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/metadata/applications/${urlSlug}`,
      {
        method: 'GET',
        headers: getApiHeaders({ jwt: token?.access_token as string }),
      },
    );

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
        proxyRes.status.toString(),
      );
    }

    json = await proxyRes.json();

    return res.status(200).send(json);
  } catch (e) {
    logger.error(e);

    if (e instanceof DialAIError) {
      return res
        .status(parseInt(e.code, 10) || 500)
        .send(e.message || errorsMessages.generalServer);
    }

    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;
