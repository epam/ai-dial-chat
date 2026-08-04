import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getEntity } from '@/src/utils/server/get-entity';
import { logger } from '@/src/utils/server/logger';
import { mapCoreEntityToDialModel } from '@/src/utils/server/map-core-entity';
import { ServerUtils, getFullToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_ID,
} from '@/src/constants/default-server-settings';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  const token = await getFullToken({ req });

  try {
    const entity = await getEntity(
      DEFAULT_MODEL.entityType,
      DEFAULT_MODEL_ID,
      token?.token ?? '',
      token?.jobTitle ?? '',
    );

    return res.status(200).json(mapCoreEntityToDialModel(entity, true));
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
