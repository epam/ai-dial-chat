import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
} from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { sanitizeUri } from 'micromark-util-sanitize-uri';
import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const {
      filter,
      recursive = 'false',
      limit = '1000',
    } = req.query as {
      filter?: BackendDataNodeType;
      recursive?: string;
      limit?: string;
    };
    const jwt = await getToken({ req });
    const slugs = Array.isArray(req.query.listing)
      ? req.query.listing
      : [req.query.listing];

    if (!slugs || slugs.length === 0) {
      throw new DialAIError(`No path provided`, 400, req);
    }

    const path = constructPath(
      process.env.DIAL_API_HOST,
      'v1/metadata',
      ServerUtils.encodeSlugs(slugs),
    );
    const searchParams = new URLSearchParams();
    searchParams.set('limit', limit);
    searchParams.set('recursive', recursive);
    searchParams.set('permissions', 'true');

    const baseUrl = `${sanitizeUri(path)}/?${searchParams}`;

    const allItems: (
      | BackendFile
      | BackendFileFolder
      | BackendChatEntity
      | BackendChatFolder
    )[] = [];
    let nextToken: string | undefined;

    do {
      const url = nextToken ? `${baseUrl}&token=${nextToken}` : baseUrl;

      const response = await fetch(url, {
        headers: getApiHeaders({ jwt }),
      });

      if (response.status === 404) {
        break;
      } else if (!response.ok) {
        const serverErrorMessage = await response.text();
        throw new DialAIError(serverErrorMessage, response.status, req);
      }

      const json = (await response.json()) as (
        | BackendFileFolder
        | BackendChatFolder
      ) & { nextToken?: string };

      if (json.items) {
        allItems.push(...json.items);
      }

      nextToken = json.nextToken;
    } while (nextToken);

    // Filtering needed to avoid DIAL Chat crashing in case of name === null || name === ''
    const result = allItems.filter(
      (item) => (!filter || item.nodeType === filter) && !!item.name,
    );

    return res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
