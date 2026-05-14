import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const jwt = await getToken({ req });

  try {
    const proxyRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/ops/resource/share/list`,
      {
        method: HTTPMethod.POST,
        headers: getApiHeaders({ jwt }),
        body: JSON.stringify(req.body),
      },
    );

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
