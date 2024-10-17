import { Account, CallbacksOptions, Profile, Session } from 'next-auth';
import { TokenEndpointHandler } from 'next-auth/providers';

import { Token } from '@/src/types/auth';

import { logger } from '../server/logger';
import NextClient, { RefreshToken } from './nextauth-client';

import { decodeJwt } from 'jose';
import get from 'lodash-es/get';
import { TokenSet } from 'openid-client';

const waitRefreshTokenTimeout = 5;

const safeDecodeJwt = (accessToken: string) => {
  try {
    return decodeJwt(accessToken);
  } catch (err) {
    console.error("Token couldn't be parsed as JWT", err);
    // TODO: read roles from GCP token format
    return {};
  }
};

const getUser = (accessToken: string | undefined, providerId: string) => {
  const rolesFieldName =
    process.env[`AUTH_${providerId.toUpperCase()}_DIAL_ROLES_FIELD`] ??
    process.env.DIAL_ROLES_FIELD ??
    'dial_roles';
  const adminRoleNames = (
    process.env[`AUTH_${providerId.toUpperCase()}_ADMIN_ROLE_NAMES`] ??
    process.env.ADMIN_ROLE_NAMES ??
    'admin'
  ).split(',');
  const decodedPayload = accessToken ? safeDecodeJwt(accessToken) : {};
  const dialRoles = get(decodedPayload, rolesFieldName, []) as string[];
  const roles = Array.isArray(dialRoles) ? dialRoles : [dialRoles];
  const isAdmin =
    roles.length > 0 && adminRoleNames.some((role) => roles.includes(role));

  return {
    isAdmin,
  };
};

// Need to be set for all providers
export const tokenConfig: TokenEndpointHandler = {
  request: async (context) => {
    let tokens;

    NextClient.setClient(context.client, context.provider);

    if (context.provider.idToken) {
      tokens = await context.client.callback(
        context.provider.callbackUrl,
        context.params,
        context.checks,
      );
    } else {
      tokens = await context.client.oauthCallback(
        context.provider.callbackUrl,
        context.params,
        context.checks,
      );
    }
    return { tokens };
  },
};

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: Token) {
  const displayedTokenSub =
    process.env.SHOW_TOKEN_SUB === 'true' ? token.sub : '******';
  try {
    if (!token.providerId) {
      throw new Error(`No provider information exists in token`);
    }
    const client = NextClient.getClient(token.providerId);
    if (!client) {
      throw new Error(`No client for appropriate provider set`);
    }

    let msWaiting = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const refresh = NextClient.getRefreshToken(token.userId);

      if (!refresh || !refresh.isRefreshing) {
        const localToken: RefreshToken = refresh || {
          isRefreshing: true,
          token,
        };
        if (
          typeof localToken.token?.accessTokenExpires === 'number' &&
          Date.now() < localToken.token.accessTokenExpires
        ) {
          return localToken.token;
        }

        NextClient.setIsRefreshTokenStart(token.userId, localToken);
        break;
      }

      await NextClient.delay();
      msWaiting += 50;

      if (msWaiting >= waitRefreshTokenTimeout * 1000) {
        throw new Error(
          `Waiting more than ${waitRefreshTokenTimeout} seconds for refreshing token`,
        );
      }
    }

    const refreshedTokens = await client.refresh(
      token.refreshToken as string | TokenSet,
    );

    if (
      !refreshedTokens ||
      (!refreshedTokens.expires_in && !refreshedTokens.expires_at)
    ) {
      throw new Error(`Error from auth provider while refreshing token`);
    }

    if (!refreshedTokens.refresh_token) {
      logger.warn(
        `Auth provider didn't provide new refresh token. Sub: ${displayedTokenSub}`,
      );
    }

    if (!refreshedTokens.refresh_token && !token.refreshToken) {
      throw new Error('No refresh tokens exists');
    }

    const returnToken = {
      ...token,
      user: getUser(refreshedTokens.access_token, token.providerId),
      access_token: refreshedTokens.access_token,
      accessTokenExpires: refreshedTokens.expires_in
        ? Date.now() + refreshedTokens.expires_in * 1000
        : (refreshedTokens.expires_at as number) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };

    NextClient.setIsRefreshTokenStart(token.userId, {
      isRefreshing: false,
      token: returnToken,
    });
    return returnToken;
  } catch (error: unknown) {
    logger.error(
      error,
      `Error when refreshing token: ${
        (error as Error).message
      }. Sub: ${displayedTokenSub}`,
    );

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const callbacks: Partial<
  CallbacksOptions<Profile & { job_title?: string }, Account>
> = {
  jwt: async (options) => {
    if (options.account) {
      return {
        ...options.token,
        user: getUser(options.account?.access_token, options.account.provider),
        jobTitle: options.profile?.job_title,
        access_token: options.account.access_token,
        accessTokenExpires:
          typeof options.account.expires_in === 'number'
            ? Date.now() + options.account.expires_in * 1000
            : (options.account.expires_at as number) * 1000,
        refreshToken: options.account.refresh_token,
        providerId: options.account.provider,
        userId: options.user.id,
        idToken: options.account.id_token,
      };
    }

    // Return previous token if the access token has not expired yet
    if (
      options.token.providerId === 'credentials' ||
      (typeof options.token.accessTokenExpires === 'number' &&
        Date.now() < options.token.accessTokenExpires)
    ) {
      return {
        ...options.token,
        user: getUser(
          options.token.access_token,
          typeof options.token.providerId === 'string'
            ? options.token.providerId
            : '',
        ),
      };
    }
    const typedToken = options.token as Token;
    // Access token has expired, try to update it
    return refreshAccessToken(typedToken);
  },
  signIn: async (options) => {
    if (!options.account?.access_token) {
      return false;
    }

    return true;
  },
  session: async (options) => {
    if (options.token?.error) {
      (options.session as Session & { error?: unknown }).error =
        options.token.error;
    }

    const isAdmin = options?.token?.user?.isAdmin ?? false;

    if (options.session.user) {
      options.session.user.isAdmin = isAdmin;
    }

    return options.session;
  },
};
