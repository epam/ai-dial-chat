import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
} from '@/src/types/common';
import { DialAIError } from '@/src/types/error';
import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const {
      filter,
      recursive = false,
      limit = 1000,
    } = req.query as {
      filter?: BackendDataNodeType;
      recursive?: string;
      limit?: number;
    };
    const token = await getToken({ req });
    // eslint-disable-next-line no-console
    console.log('token--------->', token);
    const slugs = Array.isArray(req.query.listing)
      ? req.query.listing
      : [req.query.listing];

    if (!slugs || slugs.length === 0) {
      throw new DialAIError(`No path provided`, '', '', '400');
    }

    const url = `${constructPath(
      process.env.DIAL_API_HOST,
      'v1/metadata',
      ServerUtils.encodeSlugs(slugs),
    )}/?limit=${limit}&recursive=${recursive}`;

    const response = await fetch(url, {
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    if (response.status === 404) {
      return res.status(200).send([]);
    } else if (!response.ok) {
      const serverErrorMessage = await response.text();
      throw new DialAIError(serverErrorMessage, '', '', response.status + '');
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
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
