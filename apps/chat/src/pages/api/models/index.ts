import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getSortedEntities } from '@/src/utils/server/get-sorted-entities';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getFullToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const token = await getFullToken({ req });

  try {
    const { entities, timings } = await getSortedEntities(
      token?.token ?? '',
      token?.jobTitle ?? '',
    );

    res.setHeader(
      'Server-Timing',
      [
        `models;dur=${timings.modelsMs.toFixed(1)}`,
        `apps;dur=${timings.applicationsMs.toFixed(1)}`,
        `upstream;dur=${timings.bothAwaitMs.toFixed(1)}`,
        `transform;dur=${timings.transformMs.toFixed(1)}`,
        `total;dur=${timings.totalMs.toFixed(1)}`,
      ].join(', '),
    );

    return res.status(200).json(entities);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
