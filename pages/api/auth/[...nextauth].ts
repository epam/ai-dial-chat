import type { AuthOptions, CookiesOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import KeycloakProvider from 'next-auth/providers/keycloak';

import { GitLab } from '../../../utils/auth/customGitlab';
import PingId from '../../../utils/auth/pingIdentity';

import { v5 as uuid } from 'uuid';

const DEFAULT_NAME = 'SSO';

const TEST_TOKENS = new Set((process.env.AUTH_TEST_TOKEN ?? '').split(','));

const allProviders: (Provider | boolean)[] = [
  !!process.env.AUTH_AZURE_AD_CLIENT_ID &&
    !!process.env.AUTH_AZURE_AD_SECRET &&
    !!process.env.AUTH_AZURE_AD_TENANT_ID &&
    AzureProvider({
      clientId: process.env.AUTH_AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AUTH_AZURE_AD_SECRET,
      tenantId: process.env.AUTH_AZURE_AD_TENANT_ID,
      name: process.env.AUTH_AZURE_AD_NAME ?? DEFAULT_NAME,
      authorization: { params: { scope: 'openid profile user.Read email' } },
    }),

  !!process.env.AUTH_GITLAB_CLIENT_ID &&
    !!process.env.AUTH_GITLAB_SECRET &&
    GitLab({
      clientId: process.env.AUTH_GITLAB_CLIENT_ID,
      clientSecret: process.env.AUTH_GITLAB_SECRET,
      name: process.env.AUTH_GITLAB_NAME ?? DEFAULT_NAME,
      gitlabHost: process.env.AUTH_GITLAB_HOST,
    }),

  !!process.env.AUTH_GOOGLE_CLIENT_ID &&
    !!process.env.AUTH_GOOGLE_SECRET &&
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      name: process.env.AUTH_GOOGLE_NAME ?? DEFAULT_NAME,
    }),

  !!process.env.AUTH_AUTH0_CLIENT_ID &&
    !!process.env.AUTH_AUTH0_SECRET &&
    !!process.env.AUTH_AUTH0_HOST &&
    Auth0Provider({
      clientId: process.env.AUTH_AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH_AUTH0_SECRET,
      name: process.env.AUTH_AUTH0_NAME ?? DEFAULT_NAME,
      issuer: process.env.AUTH_AUTH0_HOST,
      authorization: {
        params: {
          audience: process.env.AUTH_AUTH0_AUDIENCE,
        },
      },
    }),

  !!process.env.AUTH_PING_ID_CLIENT_ID &&
    !!process.env.AUTH_PING_ID_SECRET &&
    !!process.env.AUTH_PING_ID_HOST &&
    PingId({
      clientId: process.env.AUTH_PING_ID_CLIENT_ID,
      clientSecret: process.env.AUTH_PING_ID_SECRET,
      name: process.env.AUTH_PING_ID_NAME ?? DEFAULT_NAME,
      issuer: process.env.AUTH_PING_ID_HOST,
    }),

  !!process.env.AUTH_KEYCLOAK_CLIENT_ID &&
    !!process.env.AUTH_KEYCLOAK_SECRET &&
    !!process.env.AUTH_KEYCLOAK_HOST &&
    KeycloakProvider({
      clientId: process.env.AUTH_KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      name: process.env.AUTH_KEYCLOAK_NAME ?? DEFAULT_NAME,
      issuer: process.env.AUTH_KEYCLOAK_HOST,
      userinfo: {
        async request(context) {
          const userinfo = await context.client.userinfo(
            context.tokens.access_token as string,
          );
          return userinfo;
        },
      },
    }),

  !!process.env.AUTH_TEST_TOKEN &&
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        access_token: {
          label: 'Token',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (
          !!credentials?.access_token &&
          TEST_TOKENS.has(credentials.access_token)
        ) {
          return {
            id: uuid(
              credentials.access_token,
              'd9428888-122b-11e1-b85c-61cd3cbb3210',
            ),
            email: 'test',
            name: 'test: ' + credentials.access_token,
          };
        }
        return null;
      },
    }),
];

const providers = allProviders.filter(Boolean) as Provider[];

if (!providers.length) {
  console.error('No auth providers!');
}
// https://github.com/nextauthjs/next-auth/blob/a8dfc8ebb11ccb96fd694db888e52f0d20395e64/packages/core/src/lib/cookie.ts#L53
function defaultCookies(
  useSecureCookies: boolean,
  sameSite = 'lax',
): CookiesOptions {
  const cookiePrefix = useSecureCookies ? '__Secure-' : '';
  return {
    // default cookie options
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      // Default to __Host- for CSRF token for additional protection if using useSecureCookies
      // NB: The `__Host-` prefix is stricter than the `__Secure-` prefix.
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes in seconds
      },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes in seconds
      },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite,
        path: '/',
        secure: useSecureCookies,
      },
    },
  };
}

const getProviderRefreshUrl = (providerName: string, token: any) => {
  const providerUrls: Record<string, string | undefined> = {
    ...(!!process.env.AUTH_AZURE_AD_CLIENT_ID &&
      !!process.env.AUTH_AZURE_AD_SECRET &&
      !!process.env.AUTH_AZURE_AD_TENANT_ID && {
        ['azure']:
          `https://login.microsoftonline.com/${process.env.AUTH_AZURE_AD_TENANT_ID}/oauth2/v2.0/token?` +
          new URLSearchParams({
            client_id: process.env.AUTH_AZURE_AD_CLIENT_ID,
            client_secret: process.env.AUTH_AZURE_AD_SECRET,
            grant_type: 'refresh_token',
            scope: 'openid profile user.Read email',
            refresh_token: token.refreshToken,
          }),
      }),
    ...(!!process.env.AUTH_GITLAB_CLIENT_ID &&
      !!process.env.AUTH_GITLAB_SECRET && {
        ['gitlab']:
          `${
            process.env.AUTH_GITLAB_HOST ?? 'https://gitlab.com'
          }/oauth/token?` +
          new URLSearchParams({
            client_id: process.env.AUTH_GITLAB_CLIENT_ID,
            code_verifier: process.env.AUTH_GITLAB_SECRET,
            grant_type: 'refresh_token',
            scope: 'read_user',
            refresh_token: token.refreshToken,
          }),
      }),
    ...(!!process.env.AUTH_GOOGLE_CLIENT_ID &&
      !!process.env.AUTH_GOOGLE_SECRET && {
        ['google']:
          'https://oauth2.googleapis.com/token?' +
          new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_CLIENT_ID,
            client_secret: process.env.AUTH_GOOGLE_SECRET,
            grant_type: 'refresh_token',
            scope: 'openid email profile',
            refresh_token: token.refreshToken,
          }),
      }),
    ...(!!process.env.AUTH_AUTH0_CLIENT_ID &&
      !!process.env.AUTH_AUTH0_SECRET &&
      !!process.env.AUTH_AUTH0_HOST && {
        ['auth0']:
          `${process.env.AUTH_AUTH0_HOST}/oauth/token?` +
          new URLSearchParams({
            client_id: process.env.AUTH_AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH_AUTH0_SECRET,
            grant_type: 'refresh_token',
            scope: 'openid email profile',
            refresh_token: token.refreshToken,
          }),
      }),
    ...(!!process.env.AUTH_PING_ID_CLIENT_ID &&
      !!process.env.AUTH_PING_ID_SECRET &&
      !!process.env.AUTH_PING_ID_HOST && {
        ['ping-id']:
          `${process.env.AUTH_PING_ID_HOST}/as/token.oauth2?` +
          new URLSearchParams({
            client_id: process.env.AUTH_PING_ID_CLIENT_ID,
            client_secret: process.env.AUTH_PING_ID_SECRET,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
          }),
      }),
    ...(!!process.env.AUTH_KEYCLOAK_CLIENT_ID &&
      !!process.env.AUTH_KEYCLOAK_SECRET &&
      !!process.env.AUTH_KEYCLOAK_HOST && {
        ['keycloak']:
          `${process.env.AUTH_KEYCLOAK_HOST}/as/token.oauth2?` +
          new URLSearchParams({
            client_id: process.env.AUTH_KEYCLOAK_CLIENT_ID,
            client_secret: process.env.AUTH_KEYCLOAK_SECRET,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
          }),
      }),
  };

  return providerUrls[providerName];
};

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token: any) {
  try {
    const url = getProviderRefreshUrl(token.authProvider, token);
    if (!url) {
      throw new Error(
        `Refresh tokens is not supported by ${token.authProvider} auth provider`,
      );
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      access_token: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

const isSecure =
  !!process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('https:');

export const authOptions: AuthOptions = {
  providers,
  cookies: defaultCookies(isSecure, isSecure ? 'none' : 'lax'),
  callbacks: {
    jwt: async (options) => {
      if (options.account) {
        return {
          ...options.token,
          jobTitle: (options.profile as any).job_title,
          access_token: options.account.access_token,
          accessTokenExpires: options.account.expires_in,
          refreshToken: options.account.refresh_token,
          authProvider: options.account.provider,
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
      if (options.token) {
        (options.session as any).error = options.token.error;
      }
      return options.session;
    },
  },
  session: {
    strategy: 'jwt',
  },
};

export default NextAuth(authOptions);
