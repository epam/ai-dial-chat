import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { validateServerSession } from '@/src/utils/auth/session';
import { OpenAIError } from '@/src/utils/server';
import {
  ApiKeys,
  getEntityTypeFromPath,
  isValidEntityApiType,
} from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
} from '@/src/types/common';
import { BackendFile, BackendFileFolder } from '@/src/types/files';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const entityType = getEntityTypeFromPath(req);
  if (!entityType || !isValidEntityApiType(entityType)) {
    return res.status(500).json(errorsMessages.generalServer);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const {
      path = '',
      filter,
      bucket,
      recursive = false,
    } = req.query as {
      path: string;
      filter?: BackendDataNodeType;
      bucket: string;
      recursive?: string;
    };

    const token = await getToken({ req });

    const url = `${
      process.env.DIAL_API_HOST
    }/v1/metadata/${entityType}/${bucket}${path && `/${encodeURI(path)}`}/?limit=1000${recursive ? '&recursive=true' : ''}`;

    const response = await fetch(url, {
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    // eslint-disable-next-line no-console
    console.log(
      '------------->bucket:',
      bucket,
      '\r\n------->token:',
      token?.access_token,
    );

    if (response.status === 404) {
      return res.status(200).send([]);
    } else if (!response.ok) {
      const serverErrorMessage = await response.text();
      throw new OpenAIError(serverErrorMessage, '', '', response.status + '');
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

    const filterableEntityTypes: string[] = Object.values(ApiKeys);
    if (filter && filterableEntityTypes.includes(entityType)) {
      result = result.filter((item) => item.nodeType === filter);
    }

    return res.status(200).send(result);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
