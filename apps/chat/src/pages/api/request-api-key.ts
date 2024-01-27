import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { logger } from '@/src/utils/server/logger';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  if (
    !process.env.REQUEST_API_KEY_CODE ||
    !process.env.AZURE_FUNCTIONS_API_HOST
  ) {
    logger.error(
      'process.env.REQUEST_API_KEY_CODE or process.env.AZURE_FUNCTIONS_API_HOST not presented',
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.AZURE_FUNCTIONS_API_HOST}/api/request?code=${process.env.REQUEST_API_KEY_CODE}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...req.body,
        requester_email: session!.user?.email,
      }),
    },
  );
  if (!response.ok) {
    logger.error(
      `Received error from azure functions: ${response.status} ${
        response.statusText
      } ${await response.text()}`,
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  return res.status(200).end();
};

export default handler;
