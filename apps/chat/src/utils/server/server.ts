import { NextApiRequest } from 'next';
import { GetTokenParams, JWT, getToken as getJWTToken } from 'next-auth/jwt';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';

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
}

export const getFullToken = async (
  params: GetTokenParams,
): Promise<(JWT & { token?: string; jobTitle?: string }) | undefined> => {
  const token = await getJWTToken(params);
  if (!token) return;
  const providerId =
    typeof token.providerId === 'string' ? token.providerId : '';
  const listProviders = parseCommaSeparatedList(process.env.AUTH_PASS_IDTOKEN);
  const tokenToReturn =
    listProviders.length && listProviders.includes(providerId)
      ? token.idToken
      : token.access_token;
  return { token: tokenToReturn, ...token };
};

export const getToken = async (params: GetTokenParams) =>
  getFullToken(params).then((fullToken) => fullToken?.token);
