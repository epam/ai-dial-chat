import { NextApiRequest, NextApiResponse } from 'next';
import { GetTokenParams, JWT, getToken as getJWTToken } from 'next-auth/jwt';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import NextClient from '@/src/utils/auth/nextauth-client';

import { DialAIError } from '@/src/types/error';

import { errorsMessages } from '@/src/constants/errors';

import { ApiUtils } from './api';

import { Response as NodeFetchResponse } from 'node-fetch';

export class ServerUtils {
  public static getEntityTypeFromPath = (
    req: NextApiRequest,
  ): string | undefined => {
    return Array.isArray(req.query.entitytype) ? '' : req.query.entitytype;
  };

  public static encodeSlugs = (slugs: (string | undefined)[]): string =>
    constructPath(
      ...slugs
        .filter(Boolean)
        .map((part) => ApiUtils.safeEncodeURIComponent(part as string)),
    );

  public static safeDecodeURI = (str: string): string => {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  };

  public static getErrorMessageFromResponse = async (
    res: Response | NodeFetchResponse,
  ): Promise<string | null> => {
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return this.safeDecodeURI(
          typeof json === 'string' ? json : JSON.stringify(json),
        );
      } catch {
        return this.safeDecodeURI(text);
      }
    } catch {
      return null;
    }
  };

  public static sendAPIError = (res: NextApiResponse, error: unknown) => {
    const traceparent = res.getHeader('traceparent');

    if (error instanceof DialAIError) {
      return res.status(parseInt(error.code, 10) || 500).send({
        message: error.message || errorsMessages.generalServer,
        traceparent,
      });
    }

    return res.status(500).send({
      message: errorsMessages.generalServer,
      traceparent,
    });
  };
}

export const getFullToken = async (
  params: GetTokenParams,
): Promise<(JWT & { token?: string; jobTitle?: string }) | undefined> => {
  const token = await getJWTToken(params);
  if (!token) return;
  const providerId =
    typeof token.providerId === 'string' ? token.providerId : '';
  const listProviders = parseCommaSeparatedList(
    process.env.AUTH_IDTOKEN_PROVIDERS,
  );

  // When getServerSession() runs a token refresh in the same request it
  // writes the new token to the response cookie, but the request cookie still
  // carries the old (expired) token.  The refreshed token is stored in the
  // in-process NextClient map, so we read from there first to avoid
  // forwarding a stale bearer token to DIAL Core on the first post-expiry
  // request.
  const userId = typeof token.userId === 'string' ? token.userId : undefined;
  if (userId) {
    const refreshState = NextClient.getRefreshToken(userId);
    if (
      refreshState &&
      !refreshState.isRefreshing &&
      refreshState.token &&
      typeof refreshState.token.accessTokenExpires === 'number' &&
      Date.now() < refreshState.token.accessTokenExpires
    ) {
      const freshToken = refreshState.token;
      const freshProviderId =
        typeof freshToken.providerId === 'string'
          ? freshToken.providerId
          : providerId;
      const tokenToReturn =
        listProviders.length && listProviders.includes(freshProviderId)
          ? freshToken.idToken
          : freshToken.access_token;
      return { token: tokenToReturn, ...freshToken };
    }
  }

  const tokenToReturn =
    listProviders.length && listProviders.includes(providerId)
      ? token.idToken
      : token.access_token;
  return { token: tokenToReturn, ...token };
};

export const getToken = async (params: GetTokenParams) =>
  getFullToken(params).then((fullToken) => fullToken?.token);
