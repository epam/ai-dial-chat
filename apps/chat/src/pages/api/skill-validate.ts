import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';

import { HTTPMethod } from '@/src/types/http';

import { DIAL_API_HOST } from '@/src/constants/default-server-settings';
import { errorsMessages } from '@/src/constants/errors';

import fetch from 'node-fetch';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  if (!validateServerSession(session, req, res)) return;

  try {
    const { deploymentId, url } = (req.body ?? {}) as {
      deploymentId?: string;
      url?: string;
    };

    if (!deploymentId || !url) {
      return res.status(400).send(errorsMessages[400]);
    }

    const jwt = await getToken({ req });
    const endpointUrl = `${DIAL_API_HOST}/v1/deployments/${deploymentId}/route/v1/configuration-support/skills/validate`;

    const response = await fetch(endpointUrl, {
      method: HTTPMethod.POST,
      headers: getApiHeaders({
        jwt,
      }),
      body: JSON.stringify({ type: 'dial-prompt', url }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      return res.status(200).json({ valid: true, data });
    }

    const message =
      (await ServerUtils.getErrorMessageFromResponse(response)) ||
      `Upstream returned ${response.status}`;
    return res.status(200).json({ valid: false, message });
  } catch (error) {
    logger.error(error);
    return res.status(500).send(errorsMessages.generalServer);
  }
};

export default handler;
