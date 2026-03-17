import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { getFullToken } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';
import { HeadersNames } from '@/src/constants/server';

const URL = `${process.env.DIAL_API_HOST}/v1/ops/client-channels/subscribe`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== HTTPMethod.POST) {
    res.setHeader('Allow', HTTPMethod.POST);
    return res.status(400).send(errorsMessages[400]);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  try {
    const token = await getFullToken({ req });
    const currentChannelId = req.headers[
      HeadersNames.X_DIAL_CLIENT_CHANNEL_ID
    ] as string | undefined;

    const upstreamResponse = await fetch(URL, {
      method: HTTPMethod.POST,
      headers: {
        ...getApiHeaders({
          jwt: token?.token ?? '',
          jobTitle: token?.jobTitle ?? '',
        }),
        Accept: 'text/event-stream',
        Connection: 'keep-alive',
        ...(currentChannelId
          ? { [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: currentChannelId }
          : {}),
      },
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText = await upstreamResponse.text();

      throw new DialAIError(
        errorText || errorsMessages.generalServer,
        upstreamResponse.status,
        req,
      );
    }

    const upstreamChannelId = upstreamResponse.headers.get(
      HeadersNames.X_DIAL_CLIENT_CHANNEL_ID,
    );

    if (upstreamChannelId) {
      res.setHeader(HeadersNames.X_DIAL_CLIENT_CHANNEL_ID, upstreamChannelId);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders?.();

    const reader = upstreamResponse.body.getReader();

    let clientClosed = false;

    const cleanup = async () => {
      if (clientClosed) return;
      clientClosed = true;

      try {
        await reader.cancel();
        res.end();
      } catch (e) {
        const reason = typeof e === 'string' ? e : '';
        logger.error('Failed to cancel upstream SSE reader ' + reason);
      }
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);

    try {
      while (!clientClosed) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          res.write(value);
        }
      }
    } catch (error) {
      const reason = typeof error === 'string' ? error : '';
      logger.error('Error while reading SSE stream ' + reason);
    } finally {
      await cleanup();
    }
  } catch (error) {
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
