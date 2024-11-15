import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';

import { validateInvitationId } from '@/src/utils/app/share';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  try {
    const { invitationId } = req.body;

    validateInvitationId(invitationId);

    const proxyRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/invitations/${invitationId}`,
      {
        method: HTTPMethod.GET,
        headers: getApiHeaders({ jwt: token?.access_token as string }),
      },
    );

    let json: unknown;
    try {
      json = await proxyRes.json();
    } catch (err) {
      json = undefined;
    }

    if (!proxyRes.ok) {
      throw new DialAIError(
        (typeof json === 'string' && json) || proxyRes.statusText,
        '',
        '',
        proxyRes.status + '',
      );
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
