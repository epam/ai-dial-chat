import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { validateServerSession } from '@/src/utils/auth/session';
import { DialAIError } from '@/src/utils/server';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  const token = await getToken({ req });
  if (!isSessionValid) {
    return;
  }

  try {
    const proxyRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/ops/resource/share/discard`,
      {
        method: 'POST',
        headers: getApiHeaders({ jwt: token?.access_token as string }),
        body: JSON.stringify(req.body),
      },
    );

    let json: unknown;
    if (!proxyRes.ok) {
      try {
        json = await proxyRes.json();
      } catch (err) {
        json = undefined;
      }

      throw new DialAIError(
        (typeof json === 'string' && json) || proxyRes.statusText,
        '',
        '',
        proxyRes.status + '',
      );
    }

    return res.status(200).send(JSON.stringify({}));
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
