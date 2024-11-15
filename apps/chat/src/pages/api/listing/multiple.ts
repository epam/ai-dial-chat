import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { BackendChatEntity, BackendChatFolder } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  const body = req.body as { urls: string[] };

  if (!isSessionValid) {
    return;
  }

  if (!body.urls.length) {
    res.status(200).send([]);
  }

  try {
    const { recursive = false, limit = 1000 } = req.query as {
      recursive?: string;
      limit?: number;
    };
    const token = await getToken({ req });

    const apiUrls = body.urls.map(
      (url) =>
        `${constructPath(
          process.env.DIAL_API_HOST,
          'v1/metadata',
          url,
        )}/?limit=${limit}&recursive=${recursive}`,
    );

    const fetchPromises = apiUrls.map(async (url) => {
      const response = await fetch(url, {
        headers: getApiHeaders({ jwt: token?.access_token }),
      });

      if (response.status === 404) {
        return [];
      } else if (!response.ok) {
        const serverErrorMessage = await response.text();
        throw new DialAIError(serverErrorMessage, '', '', response.status + '');
      }

      return response.json() as Promise<BackendFileFolder | BackendChatFolder>;
    });

    const results = await Promise.all(fetchPromises);
    const combinedItems: (
      | BackendFileFolder
      | BackendChatFolder
      | BackendFile
      | BackendChatEntity
    )[] = [];

    results.forEach((res) => {
      if ('items' in res) {
        combinedItems.push(...res.items);
      }
    });

    return res.status(200).send(combinedItems);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
