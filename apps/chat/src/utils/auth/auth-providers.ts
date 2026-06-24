import {
  OAuthConfig,
  OAuthProviderType,
  Provider,
  TokenEndpointHandler,
} from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import AzureB2CProvider from 'next-auth/providers/azure-ad-b2c';
import CognitoProvider from 'next-auth/providers/cognito';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import KeycloakProvider from 'next-auth/providers/keycloak';
import OktaProvider from 'next-auth/providers/okta';

import { parseCommaSeparatedList } from '@/src/utils/app/common';

import {
  ProviderConfig,
  ProviderConfigFields,
  SupportedProviders,
  providerConfigSchema,
} from '@/src/types/auth';

import { getAuthAdditionalParamsExchangeBody } from './auth-additional-params';
import { GitLab } from './custom-gitlab';
import NextClient from './nextauth-client';
import PingId from './ping-identity';

const DEFAULT_NAME = 'SSO';

// Need to be set for all providers
const tokenConfig: TokenEndpointHandler = {
  request: async (context) => {
    let tokens;
    const exchangeBody = getAuthAdditionalParamsExchangeBody();
    const extras = exchangeBody ? { exchangeBody } : undefined;

    NextClient.setClient(context.client, context.provider);

    if (context.provider.idToken) {
      tokens = await context.client.callback(
        context.provider.callbackUrl,
        context.params,
        context.checks,
        extras,
      );
    } else {
      tokens = await context.client.oauthCallback(
        context.provider.callbackUrl,
        context.params,
        context.checks,
        extras,
      );
    }
    return { tokens };
  },
};

const getCredentialsProvider = (config: ProviderConfig) => {
  return Credentials({
    id: config.id,
    name: config.name ?? 'Credentials',
    credentials: {
      accessToken: { label: 'Access Token', type: 'text' },
      provider: { label: 'Provider', type: 'text' },
    },
    async authorize(credentials) {
      const accessToken =
        typeof credentials?.accessToken === 'string'
          ? credentials.accessToken.trim()
          : '';

      if (!accessToken) {
        console.warn('Credentials authorize missing token');
        return null;
      }

      const provider =
        typeof credentials?.provider === 'string'
          ? credentials.provider.trim()
          : '';

      return {
        id: config.id,
        name: null,
        email: null,
        accessToken,
        provider,
      } as {
        id: string;
        name: string | null;
        email: string | null;
        accessToken: string;
        provider: string;
      };
    },
  });
};

const getAzureProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.tenantId
    ? AzureProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tenantId: config.tenantId,
        name: config.name ?? DEFAULT_NAME,
        issuer: config.issuer,
        authorization: {
          params: {
            scope:
              config.scope || 'openid profile user.Read email offline_access',
            audience: config.audience,
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getAzureB2CProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.tenantId && config.userFlow
    ? AzureB2CProvider({
        id: config.id,
        issuer: config.issuer,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tenantId: config.tenantId,
        primaryUserFlow: config.userFlow,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope:
              config.scope || 'openid profile user.Read email offline_access',
          },
        },
        token: tokenConfig,
        profile: (profile) => ({
          id: profile.sub,
          name: profile.name,
          email: (profile as { email?: string }).email ?? profile.emails?.[0],
        }),
      })
    : undefined;

const getGitLabProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret
    ? GitLab({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        name: config.name ?? DEFAULT_NAME,
        gitlabHost: config.host,
        authorization: {
          params: { scope: config.scope || 'read_user' },
        },
        token: tokenConfig,
      })
    : undefined;

const getGoogleProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret
    ? GoogleProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope: config.scope || 'openid email profile offline_access',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getAuth0Provider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.host
    ? Auth0Provider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        name: config.name ?? DEFAULT_NAME,
        issuer: config.host,
        authorization: {
          params: {
            audience: config.audience,
            scope: config.scope || 'openid email profile offline_access',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getPingIdProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.host
    ? PingId({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        name: config.name ?? DEFAULT_NAME,
        issuer: config.host,
        authorization: {
          params: {
            scope: config.scope || 'offline_access',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getKeycloakProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.host
    ? KeycloakProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        name: config.name ?? DEFAULT_NAME,
        issuer: config.host,
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
            scope: config.scope || 'openid email profile offline_access',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getCognitoProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.host
    ? CognitoProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.host,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope: config.scope || 'openid email profile',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const getOktaProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.issuer
    ? OktaProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope: config.scope || 'openid email profile',
          },
        },
        token: tokenConfig,
      })
    : undefined;

const providerNames = {
  [SupportedProviders.AUTH0]: 'auth0',
  [SupportedProviders.AZURE_B2C]: 'azure-ad-b2c',
  [SupportedProviders.AZURE_AD]: 'azure-ad',
  [SupportedProviders.COGNITO]: 'cognito',
  [SupportedProviders.GOOGLE]: 'google',
  [SupportedProviders.KEYCLOAK]: 'keycloak',
  [SupportedProviders.OKTA]: 'okta',
  [SupportedProviders.GITLAB]: 'gitlab',
  [SupportedProviders.PING_ID]: 'pingId',
  [SupportedProviders.CREDENTIALS]: 'credentials',
};

const isOAuthProvider = (
  provider: Provider,
): provider is OAuthConfig<Record<string, unknown>> => {
  return provider.type === 'oauth';
};
export const getProviderConfigById = (
  providerId: string | undefined,
): OAuthConfig<Record<string, unknown>> | undefined => {
  const result = authProviders
    .filter(isOAuthProvider)
    .find((p) => p.id === providerId);
  return result;
};

export const CREDENTIALS_PROVIDER_ID =
  providerNames[SupportedProviders.CREDENTIALS];

export const isCredentialsProvider = (providerId: string | undefined) =>
  providerId === CREDENTIALS_PROVIDER_ID;

const providerConfigMethods = {
  [SupportedProviders.AUTH0]: getAuth0Provider,
  [SupportedProviders.AZURE_B2C]: getAzureB2CProvider,
  [SupportedProviders.AZURE_AD]: getAzureProvider,
  [SupportedProviders.COGNITO]: getCognitoProvider,
  [SupportedProviders.GOOGLE]: getGoogleProvider,
  [SupportedProviders.KEYCLOAK]: getKeycloakProvider,
  [SupportedProviders.OKTA]: getOktaProvider,
  [SupportedProviders.GITLAB]: getGitLabProvider,
  [SupportedProviders.PING_ID]: getPingIdProvider,
  [SupportedProviders.CREDENTIALS]: getCredentialsProvider,
};

const getProviderFromConfig = (config: ProviderConfig) => {
  return providerConfigMethods[config.provider]?.(config);
};

const getProviderEnv = (
  provider: SupportedProviders,
  envName: ProviderConfigFields,
  index = 0,
) => {
  const indexStr = index ? `_${index}` : '';
  return process.env[`AUTH_${provider}${indexStr}_${envName}`];
};

export const getProviderConfig = (provider: SupportedProviders, index = 0) => {
  const getEnv = (name: ProviderConfigFields) =>
    getProviderEnv(provider, name, index);

  const config = {
    provider,
    id: `${providerNames[provider]}${index || ''}`,
    clientId: getEnv(ProviderConfigFields.CLIENT_ID),
    clientSecret:
      getEnv(ProviderConfigFields.CLIENT_SECRET) ??
      getEnv(ProviderConfigFields.SECRET),
    name: getEnv(ProviderConfigFields.NAME),
    host: getEnv(ProviderConfigFields.HOST),
    scope: getEnv(ProviderConfigFields.SCOPE),
    audience: getEnv(ProviderConfigFields.AUDIENCE),
    tenantId: getEnv(ProviderConfigFields.TENANT_ID),
    userFlow: getEnv(ProviderConfigFields.USER_FLOW),
    issuer: getEnv(ProviderConfigFields.ISSUER),
    adminRoleNames: getEnv(ProviderConfigFields.ADMIN_ROLE_NAMES),
    dialRolesField: getEnv(ProviderConfigFields.DIAL_ROLES_FIELD),
  };

  return providerConfigSchema.safeParse(config).success
    ? (config as ProviderConfig)
    : undefined;
};

const getSSOConfigs = () => {
  return Object.values(SupportedProviders).flatMap((provider) => {
    let index = 0;
    const configs = [getProviderConfig(provider, index)];
    while (configs[configs.length - 1]) {
      index += 1;
      configs.push(getProviderConfig(provider, index));
    }

    return configs.filter(Boolean) as ProviderConfig[];
  });
};

const getProviders = () => {
  const configs = getSSOConfigs();

  return configs.map(getProviderFromConfig).filter(Boolean) as Provider[];
};

// TODO: create a validator for providers options
export const authProviders = getProviders();

// Pre-register OIDC metadata so token refresh works after server restarts,
// without waiting for a login to happen on the current process instance.
authProviders.forEach((provider) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = provider as OAuthConfig<any>;
  const issuerUrl = typeof p.issuer === 'string' ? p.issuer : undefined;
  const clientId = typeof p.clientId === 'string' ? p.clientId : undefined;
  const clientSecret =
    typeof p.clientSecret === 'string' ? p.clientSecret : undefined;
  if (issuerUrl && clientId && clientSecret) {
    NextClient.setProviderMeta(provider.id, {
      issuerUrl,
      clientId,
      clientSecret,
    });
  }
});

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
const FEDERATED_LOGOUT_PROVIDERS = parseCommaSeparatedList(
  process.env.FEDERATED_LOGOUT_PROVIDERS,
);

export const DEFAULT_PROVIDER: OAuthProviderType | null =
  authProviders.length === 1 &&
  process.env.SKIP_AUTH_PROVIDER_SELECTION &&
  FEDERATED_LOGOUT_PROVIDERS.includes(authProviders[0]?.id as OAuthProviderType)
    ? (authProviders[0]?.id as OAuthProviderType)
    : null;

/**
 * Is authorization enabled
 *
 * Use only in server context
 *
 * @type {boolean}
 */
export const isAuthDisabled: boolean =
  process.env.AUTH_FORCE_STRICT !== 'true' && authProviders.length === 0;
