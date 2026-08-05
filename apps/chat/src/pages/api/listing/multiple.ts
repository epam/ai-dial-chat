import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { isValidEntityApiType } from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { BackendChatEntity, BackendChatFolder } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { sanitizeUri } from 'micromark-util-sanitize-uri';
import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
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
    const { recursive = 'false', limit = '1000' } = req.query as {
      recursive?: string;
      limit?: string;
    };
    const searchParams = new URLSearchParams();
    searchParams.set('recursive', recursive);
    searchParams.set('limit', limit);
    searchParams.set('permissions', 'true');

    const jwt = await getToken({ req });

    const apiUrls = body.urls
      .map((url) => {
        const entityType = url.split('/')[0];
        if (isValidEntityApiType(entityType)) {
          return `${constructPath(
            process.env.DIAL_API_HOST,
            'v1/metadata',
            sanitizeUri(url),
          )}/?${searchParams}`;
        }
        return;
      })
      .filter(Boolean) as string[];

    const fetchPromises = apiUrls.map(async (url) => {
      const response = await fetch(url, {
        headers: getApiHeaders({ jwt }),
      });

      if (response.status === 404) {
        return [];
      } else if (!response.ok) {
        const serverErrorMessage = await response.text();
        throw new DialAIError(serverErrorMessage, response.status, req);
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
        // Filtering needed to avoid DIAL Chat crashing in case of name === null || name === ''
        combinedItems.push(...res.items.filter((item) => !!item.name));
      }
    });

    return res.status(200).send(combinedItems);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
