import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';
import { setTraceparentHeader } from '@/src/utils/server/traceparent';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';
import { HeadersNames } from '@/src/constants/server';

const host = process.env.DIAL_API_HOST;
const URL = `${host}/v1/ops/client-channel/subscribe`;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  setTraceparentHeader(res);
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return;
  }

  let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | null =
    null;
  let clientClosed = false;
  const abortController = new AbortController();

  const cleanup = async () => {
    if (clientClosed) return;
    clientClosed = true;

    abortController?.abort();

    try {
      await reader?.cancel?.();
      if (!res.writableEnded) {
        res.end();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to cancel upstream SSE reader: ${message}`);
    }
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('close', cleanup);

  try {
    const jwt = await getToken({ req });
    const currentChannelId = req.headers[
      HeadersNames.X_DIAL_CLIENT_CHANNEL_ID
    ] as string | undefined;

    const upstreamResponse = await fetch(URL, {
      method: HTTPMethod.POST,
      headers: {
        ...getApiHeaders({ jwt }),
        Accept: 'text/event-stream',
        Connection: 'keep-alive',
        ...(currentChannelId
          ? { [HeadersNames.X_DIAL_CLIENT_CHANNEL_ID]: currentChannelId }
          : {}),
      },
      signal: abortController.signal,
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const errorText =
        await ServerUtils.getErrorMessageFromResponse(upstreamResponse);
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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    res.flushHeaders?.();

    res.write(': init\n\n');

    reader = upstreamResponse.body.getReader();

    while (!clientClosed) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      if (value && !res.writableEnded) {
        res.write(value);
      }
    }
  } catch (error) {
    logger.error(error);
    return ServerUtils.sendAPIError(res, error);
  } finally {
    req.off('close', cleanup);
    req.off('aborted', cleanup);
    res.off('close', cleanup);
    await cleanup();
  }
};

export default handler;
