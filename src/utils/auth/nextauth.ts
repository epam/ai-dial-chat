import { Account, CallbacksOptions, Profile } from 'next-auth';
import { TokenEndpointHandler } from 'next-auth/providers';

import NextClient from './nextauth-client';

export const TEST_TOKENS = new Set(
  (process.env.AUTH_TEST_TOKEN ?? '').split(','),
);

// Need to be set for all providers
export const tokenConfig: TokenEndpointHandler = {
  request: async (context) => {
    let tokens;

    NextClient.client = context.client;

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
async function refreshAccessToken(token: any) {
  try {
    if (!NextClient.client) {
      throw new Error('No openid client set');
    }

    const refreshedTokens = await NextClient.client.refresh(token.refreshToken);

    if (
      !refreshedTokens ||
      (!refreshedTokens.expires_in && !refreshedTokens.expires_at)
    ) {
      throw new Error('Error while refreshing token');
    }

    return {
      ...token,
      access_token: refreshedTokens.access_token,
      accessTokenExpires: refreshedTokens.expires_in
        ? Date.now() + refreshedTokens.expires_in * 1000
        : (refreshedTokens.expires_at as number) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error: any) {
    console.error(error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const callbacks: Partial<CallbacksOptions<Profile, Account>> = {
  jwt: async (options) => {
    if (options.account) {
      return {
        ...options.token,
        jobTitle: (options.profile as any)?.job_title,
        access_token: options.account.access_token,
        accessTokenExpires:
          typeof options.account.expires_in === 'number'
            ? Date.now() + options.account.expires_in * 1000
            : (options.account.expires_at as number) * 1000,
        refreshToken: options.account.refresh_token,
      };
    }

    // Return previous token if the access token has not expired yet
    if (
      typeof options.token.accessTokenExpires === 'number' &&
      Date.now() < options.token.accessTokenExpires
    ) {
      return options.token;
    }

    // Access token has expired, try to update it
    return refreshAccessToken(options.token);
  },
  signIn: async (options) => {
    if (
      options.account?.type === 'credentials' &&
      !!options.credentials?.access_token &&
      TEST_TOKENS.has(options.credentials.access_token as string)
    ) {
      return true;
    }

    if (!options.account?.access_token) {
      return false;
    }

    return true;
  },
  session: async (options) => {
    if (options.token?.error) {
      (options.session as any).error = options.token.error;
    }
    return options.session;
  },
};
