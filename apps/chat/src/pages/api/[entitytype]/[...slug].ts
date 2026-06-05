import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';

import { constructPath } from '@/src/utils/app/file';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';
import { isValidEntityApiType } from '@/src/utils/server/api';
import { getApiHeaders } from '@/src/utils/server/get-headers';
import { logger } from '@/src/utils/server/logger';
import { ServerUtils, getToken } from '@/src/utils/server/server';

import { DialAIError } from '@/src/types/error';
import { HTTPMethod } from '@/src/types/http';

import { errorsMessages } from '@/src/constants/errors';

import { sanitizeUri } from 'micromark-util-sanitize-uri';
import fetch, { Response } from 'node-fetch';
import { Readable } from 'stream';

const getEntityUrlFromSlugs = (
  dialApiHost: string,
  req: NextApiRequest,
): string => {
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  const slugs = Array.isArray(req.query.slug)
    ? req.query.slug
    : [req.query.slug];

  if (!slugs || slugs.length === 0) {
    throw new DialAIError(`No ${entityType} path provided`, 400, req);
  }

  return sanitizeUri(
    constructPath(
      dialApiHost,
      'v1',
      entityType,
      ServerUtils.encodeSlugs(slugs),
    ),
  );
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const entityType = ServerUtils.getEntityTypeFromPath(req);
  if (!entityType || !isValidEntityApiType(entityType)) {
    return res.status(400).json(errorsMessages.notValidEntityType);
  }

  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);

  if (!isSessionValid) {
    return;
  }

  const token = await getToken({ req });

  try {
    if (req.method === HTTPMethod.GET) {
      return await handleGetRequest(req, token, res);
    } else if (req.method === HTTPMethod.PUT) {
      return await handlePutRequest(req, token, res);
    } else if (req.method === HTTPMethod.POST) {
      return await handlePutRequest(req, token, res, { ifNoneMatch: '*' });
    } else if (req.method === HTTPMethod.DELETE) {
      return await handleDeleteRequest(req, token, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    logger.error(error);
    if (error instanceof DialAIError) {
      return res
        .status(parseInt(error.code, 10) || 500)
        .send(error.message || errorsMessages.generalServer);
    }
    return res
      .status(500)
      .send(errorsMessages.errorDuringEntityRequest(entityType));
  }
};

export default handler;

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};
interface PutOptions {
  ifNoneMatch?: string;
}
async function getProxyErrorMessage(
  proxyRes: Response,
  url: string,
): Promise<string> {
  if (proxyRes.status === 404) {
    return errorsMessages.fileNotFound;
  }
  if (proxyRes.status === 403) {
    return errorsMessages.fileAccessRevoked;
  }

  let text: string | undefined;
  try {
    text = await proxyRes.text();
  } catch {
    text = undefined;
  }

  let json: unknown;
  try {
    if (text) {
      json = JSON.parse(text);
    }
  } catch {
    json = undefined;
  }

  let errorMessage = '';
  if (typeof json === 'object' && json !== null) {
    const jsonObj = json as Record<string, unknown>;
    const errorObj = jsonObj.error;

    if (typeof errorObj === 'object' && errorObj !== null) {
      const nestedMessage = (errorObj as Record<string, unknown>).message;
      if (typeof nestedMessage === 'string') {
        errorMessage = nestedMessage;
      }
    } else if (typeof errorObj === 'string') {
      errorMessage = errorObj;
    } else if (typeof jsonObj.message === 'string') {
      errorMessage = jsonObj.message;
    }
  }

  if (!errorMessage && text) {
    errorMessage = text;
  }

  if (!errorMessage) {
    errorMessage = errorsMessages.requestingEntityFailed(url, proxyRes.statusText);
  }

  return errorMessage;
}

async function handlePutRequest(
  req: NextApiRequest,
  jwt: string | undefined,
  res: NextApiResponse,
  options?: PutOptions,
) {
  const readable = Readable.from(req);
  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);
  const proxyRes = await fetch(url, {
    method: HTTPMethod.PUT,
    headers: {
      ...getApiHeaders({
        jwt,
        ifNoneMatch: options?.ifNoneMatch,
      }),
      'Content-Type': req.headers['content-type'] as string,
    },
    body: readable,
  });

  if (!proxyRes.ok) {
    const errorMessage = await getProxyErrorMessage(proxyRes, url);
    throw new DialAIError(errorMessage, proxyRes.status, req);
  }

  let json: unknown;
  try {
    json = await proxyRes.json();
  } catch {
    json = undefined;
  }

  return res.status(200).send(json);
}

async function handleGetRequest(
  req: NextApiRequest,
  jwt: string | undefined,
  res: NextApiResponse,
) {
  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);
  const proxyRes = await fetch(url, {
    headers: getApiHeaders({ jwt }),
  });

  if (!proxyRes.ok) {
    const errorMessage = await getProxyErrorMessage(proxyRes, url);
    throw new DialAIError(errorMessage, proxyRes.status, req);
  }

  res.status(proxyRes.status);
  res.setHeader('transfer-encoding', 'chunked');
  res.setHeader(
    'Content-Type',
    proxyRes.headers.get('Content-Type') ??
      req.headers['content-type'] ??
      'application/json',
  );

  proxyRes.body?.pipe(res);
}

async function handleDeleteRequest(
  req: NextApiRequest,
  jwt: string | undefined,
  res: NextApiResponse,
) {
  const url = getEntityUrlFromSlugs(process.env.DIAL_API_HOST, req);
  const proxyRes = await fetch(url, {
    method: HTTPMethod.DELETE,
    headers: getApiHeaders({ jwt }),
  });

  if (!proxyRes.ok) {
    const errorMessage = await getProxyErrorMessage(proxyRes, url);
    throw new DialAIError(errorMessage, proxyRes.status, req);
  }

  return res.status(200).send({});
}
