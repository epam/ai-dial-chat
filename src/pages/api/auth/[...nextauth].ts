import type { AuthOptions, CookiesOptions } from 'next-auth';
import NextAuth from 'next-auth/next';
import { Provider } from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import KeycloakProvider from 'next-auth/providers/keycloak';

import { GitLab } from '../../../utils/auth/custom-gitlab';
import PingId from '../../../utils/auth/ping-identity';
import { callbacks, tokenConfig } from '@/src/utils/auth/nextauth';
import { logger } from '@/src/utils/server/logger';

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
      authorization: {
        params: {
          scope:
            process.env.AUTH_AZURE_AD_SCOPE ||
            'openid profile user.Read email offline_access',
        },
      },
      token: tokenConfig,
    }),

  !!process.env.AUTH_GITLAB_CLIENT_ID &&
    !!process.env.AUTH_GITLAB_SECRET &&
    GitLab({
      clientId: process.env.AUTH_GITLAB_CLIENT_ID,
      clientSecret: process.env.AUTH_GITLAB_SECRET,
      name: process.env.AUTH_GITLAB_NAME ?? DEFAULT_NAME,
      gitlabHost: process.env.AUTH_GITLAB_HOST,
      authorization: {
        params: { scope: process.env.AUTH_GITLAB_SCOPE || 'read_user' },
      },
      token: tokenConfig,
    }),

  !!process.env.AUTH_GOOGLE_CLIENT_ID &&
    !!process.env.AUTH_GOOGLE_SECRET &&
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      name: process.env.AUTH_GOOGLE_NAME ?? DEFAULT_NAME,
      authorization: {
        params: {
          scope:
            process.env.AUTH_GOOGLE_SCOPE ||
            'openid email profile offline_access',
        },
      },
      token: tokenConfig,
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
          scope:
            process.env.AUTH_AUTH0_SCOPE ||
            'openid email profile offline_access',
        },
      },
      token: tokenConfig,
    }),

  !!process.env.AUTH_PING_ID_CLIENT_ID &&
    !!process.env.AUTH_PING_ID_SECRET &&
    !!process.env.AUTH_PING_ID_HOST &&
    PingId({
      clientId: process.env.AUTH_PING_ID_CLIENT_ID,
      clientSecret: process.env.AUTH_PING_ID_SECRET,
      name: process.env.AUTH_PING_ID_NAME ?? DEFAULT_NAME,
      issuer: process.env.AUTH_PING_ID_HOST,
      authorization: {
        params: {
          scope: process.env.AUTH_PING_ID_SCOPE || 'offline_access',
        },
      },
      token: tokenConfig,
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
      authorization: {
        params: {
          scope:
            process.env.AUTH_KEYCLOAK_SCOPE ||
            'openid email profile offline_access',
        },
      },
      token: tokenConfig,
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

if (!providers.length && process.env.AUTH_DISABLED !== 'true') {
  logger.error('No auth providers!');
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

const isSecure =
  !!process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith('https:');

export const authOptions: AuthOptions = {
  providers,
  cookies: defaultCookies(isSecure, isSecure ? 'none' : 'lax'),
  callbacks,
  session: {
    strategy: 'jwt',
  },
  theme: {
    logo: process.env.THEMES_CONFIG_HOST
      ? `${process.env.APP_BASE_PATH || ''}/api/themes-image?name=favicon`
      : undefined,
  },
};

export default NextAuth(authOptions);
