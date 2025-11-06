import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { logger } from '@/src/utils/server/logger';

import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from './auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  if (!process.env.REPORT_ISSUE_CODE || !process.env.AZURE_FUNCTIONS_API_HOST) {
    logger.error(
      'process.env.REPORT_ISSUE_CODE or process.env.AZURE_FUNCTIONS_API_HOST not presented',
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.AZURE_FUNCTIONS_API_HOST}/api/issue?code=${process.env.REPORT_ISSUE_CODE}`,
    {
      method: HTTPMethod.POST,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...req.body,
        email: session!.user?.email,
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

  return res.status(200).send(JSON.stringify({}));
};

export default handler;
