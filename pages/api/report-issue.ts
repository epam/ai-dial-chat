import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from './auth/[...nextauth]';

import { errorsMessages } from '@/constants/errors';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).send(errorsMessages[401]);
  }

  if (!process.env.REPORT_ISSUE_CODE || !process.env.AZURE_FUNCTIONS_API_HOST) {
    console.error(
      'process.env.REPORT_ISSUE_CODE or process.env.AZURE_FUNCTIONS_API_HOST not presented',
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  const controller = new AbortController();
  const response = await fetch(
    `${process.env.AZURE_FUNCTIONS_API_HOST}/api/issue?code=${process.env.REPORT_ISSUE_CODE}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...req.body,
        email: session.user?.email,
      }),
    },
  );
  if (!response.ok) {
    console.error(
      `Received error from azure functions: ${response.status} ${
        response.statusText
      } ${await response.text()}`,
    );
    return res.status(500).send(errorsMessages.generalServer);
  }

  return res.status(200).end();
};

export default handler;
