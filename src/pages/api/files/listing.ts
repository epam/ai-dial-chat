import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { getApiHeaders } from '../../../utils/server/get-headers';
import { validateServerSession } from '@/src/utils/auth/session';
import { OpenAIError } from '@/src/utils/server';
import { logger } from '@/src/utils/server/logger';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '../auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const { path = '', filter = '' } = req.query as {
      path: string;
      filter: string;
    };

    const token = await getToken({ req });
    const query = new URLSearchParams({
      purpose: 'metadata',
    });
    const resultQuery = query.toString();

    const url = `${process.env.OPENAI_API_HOST}/v1/files${
      path && `/${encodeURI(path)}`
    }?${resultQuery}`;
    const response = await fetch(url, {
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    if (!response.ok) {
      const serverErrorMessage = await response.text();
      throw new OpenAIError(serverErrorMessage, '', '', response.status + '');
    }

    let json = (await response.json()) as { type: 'FILE' | 'FOLDER' }[];
    if (filter) {
      json = json.filter((item) => item.type === filter);
    }

    return res.status(200).send(json);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
