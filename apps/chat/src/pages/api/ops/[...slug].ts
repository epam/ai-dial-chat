import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { JWT, getToken } from 'next-auth/jwt';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils } from '@/src/utils/server/server';

import { ApiKeys } from '@/src/types/common';
import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });
  console.log('hi', req.body);
  
  try {
    const moveRes = await fetch(
      `${process.env.DIAL_API_HOST}/v1/ops/resource/move`, 
      {
        method: 'POST',
        headers: getApiHeaders({ jwt: token?.access_token as string }),
        body: JSON.stringify(req.body), 
      },
    );

    if (!moveRes.ok) {
      throw new DialAIError(
        `Move operation failed`,
        '', 
        '', 
        moveRes.status + '', 
      );
    }
    return res.status(200).send({});
  } catch (error: unknown) {
    logger.error(error);
    if (error instanceof DialAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;
