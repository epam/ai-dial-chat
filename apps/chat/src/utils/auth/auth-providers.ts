import { Provider } from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import CognitoProvider from 'next-auth/providers/cognito';
import GoogleProvider from 'next-auth/providers/google';
import KeycloakProvider from 'next-auth/providers/keycloak';
import OktaProvider from 'next-auth/providers/okta';

import { tokenConfig } from './auth-callbacks';
import { GitLab } from './custom-gitlab';
import PingId from './ping-identity';

const DEFAULT_NAME = 'SSO';

// TODO: create a validator for providers options
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

  !!process.env.AUTH_COGNITO_CLIENT_ID &&
    !!process.env.AUTH_COGNITO_SECRET &&
    !!process.env.AUTH_COGNITO_HOST &&
    CognitoProvider({
      clientId: process.env.AUTH_COGNITO_CLIENT_ID,
      clientSecret: process.env.AUTH_COGNITO_SECRET,
      issuer: process.env.AUTH_COGNITO_HOST,
      name: process.env.AUTH_COGNITO_NAME ?? DEFAULT_NAME,
      authorization: {
        params: {
          scope: process.env.AUTH_COGNITO_SCOPE || 'openid email profile',
        },
      },
      token: tokenConfig,
    }),

  !!process.env.AUTH_OKTA_CLIENT_SECRET &&
    !!process.env.AUTH_OKTA_CLIENT_ID &&
    !!process.env.AUTH_OKTA_ISSUER &&
    OktaProvider({
      clientId: process.env.AUTH_OKTA_CLIENT_ID,
      clientSecret: process.env.AUTH_OKTA_CLIENT_SECRET,
      issuer: process.env.AUTH_OKTA_ISSUER,
      authorization: {
        params: {
          scope: process.env.AUTH_OKTA_SCOPE || 'openid email profile',
        },
      },
      token: tokenConfig,
    }),
];

export const authProviders = allProviders.filter(Boolean) as Provider[];

/**
 * Sets the DEFAULT_PROVIDER to the single available provider's ID if:
 * - There is only one authentication provider configured.
 * - The provider supports federated logout.
 *
 * This allows us to skip the NextAuth provider selection page and
 * directly use the single available provider for authentication.
 * By ensuring the provider supports federated logout, we maintain
 * proper session management and user experience during logout operations.
 */
const FEDERATED_LOGOUT_PROVIDERS = ['auth0', 'keycloak'];
export const DEFAULT_PROVIDER =
  authProviders.length === 1 &&
  FEDERATED_LOGOUT_PROVIDERS.includes(authProviders[0]?.id)
    ? authProviders[0]?.id
    : null;

/**
 * Is authorization enabled
 *
 * Use only in server context
 *
 * @type {boolean}
 */
export const isAuthDisabled: boolean = authProviders.length === 0;
