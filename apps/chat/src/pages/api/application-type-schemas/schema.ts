import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';

import { constructPath } from '@/src/utils/app/file';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
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

  try {
    const token = await getToken({ req });

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid schema ID' });
    }

    const detailedSchemaUrl = `${constructPath(
      process.env.DIAL_API_HOST,
      'v1',
      'application_type_schemas',
      `schema?id=${encodeURIComponent(id)}`,
    )}`;

    const detailedSchemaResponse = await fetch(detailedSchemaUrl, {
      headers: getApiHeaders({ jwt: token?.access_token as string }),
    });

    if (detailedSchemaResponse.status === 404) {
      return res.status(404).json({ error: 'Schema not found' });
    } else if (!detailedSchemaResponse.ok) {
      const serverErrorMessage = await detailedSchemaResponse.text();
      throw new DialAIError(
        serverErrorMessage,
        '',
        '',
        detailedSchemaResponse.status + '',
      );
    }

    const json =
      (await detailedSchemaResponse.json()) as ApiDetailedApplicationTypeSchema;

    return res.status(200).json(json);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(errorsMessages.generalServer);
  }
};

export default handler;
