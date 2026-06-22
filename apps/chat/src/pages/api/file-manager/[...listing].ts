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
      permissions = 'true',
    } = req.query as {
      filter?: BackendDataNodeType;
      recursive?: string;
      limit?: string;
      permissions?: string;
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
    searchParams.set('permissions', permissions);

    const url = `${sanitizeUri(path)}/?${searchParams}`;

    if (recursive === 'true') {
      const allItems: (
        | BackendFile
        | BackendFileFolder
        | BackendChatEntity
        | BackendChatFolder
      )[] = [];
      let currentToken: string | undefined;

      do {
        const paginatedUrl = currentToken
          ? `${url}&token=${currentToken}`
          : url;

        const response = await fetch(paginatedUrl, {
          headers: getApiHeaders({ jwt }),
        });

        if (response.status === 404) {
          break;
        } else if (!response.ok) {
          const serverErrorMessage = await response.text();
          throw new DialAIError(serverErrorMessage, response.status, req);
        }

        const json = (await response.json()) as
          | BackendFileFolder
          | BackendChatFolder;

        if (json.items) {
          allItems.push(...json.items);
        }

        currentToken = (json as unknown as { nextToken?: string }).nextToken;
      } while (currentToken);

      let result = allItems;

      // Filtering needed to avoid DIAL Chat crashing in case of name === null || name === ''
      result = result.filter(
        (item) => (!filter || item.nodeType === filter) && !!item.name,
      );

      return res.status(200).send(result);
    }

    const response = await fetch(url, {
      headers: getApiHeaders({ jwt }),
    });

    if (response.status === 404) {
      return res.status(200).send([]);
    } else if (!response.ok) {
      const serverErrorMessage = await response.text();
      throw new DialAIError(serverErrorMessage, response.status, req);
    }

    const json = (await response.json()) as
      | BackendFileFolder
      | BackendChatFolder;
    let result: (
      | BackendFile
      | BackendFileFolder
      | BackendChatEntity
      | BackendChatFolder
    )[] = json.items || [];

    if (filter) {
      result = result.filter((item) => item.nodeType === filter);
    }

    return res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
