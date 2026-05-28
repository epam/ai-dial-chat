import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { DialAIError } from '@/src/types/error';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const jwt = await getToken({ req });

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      throw new DialAIError('Missing or invalid schema ID', 400, req);
    }

    const detailedSchemaUrl = `${constructPath(
      process.env.DIAL_API_HOST,
      'v1',
      'application_type_schemas',
      `schema?id=${encodeURIComponent(id)}`,
    )}`;

    const detailedSchemaResponse = await fetch(detailedSchemaUrl, {
      headers: getApiHeaders({ jwt }),
    });

    if (detailedSchemaResponse.status === 404) {
      throw new DialAIError('Schema not found', 404, req);
    } else if (!detailedSchemaResponse.ok) {
      const serverErrorMessage = await detailedSchemaResponse.text();
      throw new DialAIError(
        serverErrorMessage,
        detailedSchemaResponse.status,
        req,
      );
    }

    const json =
      (await detailedSchemaResponse.json()) as ApiDetailedApplicationTypeSchema;

    return res.status(200).json(json);
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  }
};

export default handler;
