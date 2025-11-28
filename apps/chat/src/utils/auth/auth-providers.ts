import { OAuthProviderType, Provider } from 'next-auth/providers';
import Auth0Provider from 'next-auth/providers/auth0';
import AzureProvider from 'next-auth/providers/azure-ad';
import AzureB2CProvider from 'next-auth/providers/azure-ad-b2c';
import CognitoProvider from 'next-auth/providers/cognito';
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

import { tokenConfig } from './auth-callbacks';
import { GitLab } from './custom-gitlab';
import PingId from './ping-identity';

const DEFAULT_NAME = 'SSO';

const getAzureProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.tenantId
    ? AzureProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tenantId: config.tenantId,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope:
              config.scope || 'openid profile user.Read email offline_access',
          },
        },
        token: tokenConfig,
      })
    : null;

const getAzureB2CProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.tenantId
    ? AzureB2CProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        tenantId: config.tenantId,
        name: config.name ?? DEFAULT_NAME,
        authorization: {
          params: {
            scope:
              config.scope || 'openid profile user.Read email offline_access',
          },
        },
        token: tokenConfig,
      })
    : null;

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
    : null;

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
    : null;

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
    : null;

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
    : null;

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
    : null;

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
    : null;

const getOktaProvider = (config: ProviderConfig) =>
  config.clientId && config.clientSecret && config.issuer
    ? OktaProvider({
        id: config.id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
        authorization: {
          params: {
            scope: config.scope || 'openid email profile',
          },
        },
        token: tokenConfig,
      })
    : null;

const getProviderFromConfig = (config: ProviderConfig) => {
  switch (config.provider) {
    case SupportedProviders.AUTH0:
      return getAuth0Provider(config);
    case SupportedProviders.GOOGLE:
      return getGoogleProvider(config);
    case SupportedProviders.AZURE_AD:
      return getAzureProvider(config);
    case SupportedProviders.AZURE_B2C:
      return getAzureB2CProvider(config);
    case SupportedProviders.GITLAB:
      return getGitLabProvider(config);
    case SupportedProviders.PING_ID:
      return getPingIdProvider(config);
    case SupportedProviders.KEYCLOAK:
      return getKeycloakProvider(config);
    case SupportedProviders.COGNITO:
      return getCognitoProvider(config);
    case SupportedProviders.OKTA:
      return getOktaProvider(config);
    default:
      return null;
  }
};

const getProviderEnv = (
  provider: SupportedProviders,
  envName: ProviderConfigFields,
  index = 0,
) => {
  const indexStr = index ? `_${index}` : '';
  return process.env[`AUTH_${provider}${indexStr}_${envName}`];
};

const providerNames = {
  [SupportedProviders.AUTH0]: 'auth0',
  [SupportedProviders.AZURE_B2C]: 'azureB2C',
  [SupportedProviders.AZURE_AD]: 'azure',
  [SupportedProviders.COGNITO]: 'cognito',
  [SupportedProviders.GOOGLE]: 'google',
  [SupportedProviders.KEYCLOAK]: 'keycloak',
  [SupportedProviders.OKTA]: 'okta',
  [SupportedProviders.GITLAB]: 'gitlab',
  [SupportedProviders.PING_ID]: 'pingId',
};

const getProviderConfig = (provider: SupportedProviders, index = 0) => {
  const config = {
    provider,
    id: `${providerNames[provider]}${index || ''}`,
    clientId: getProviderEnv(provider, ProviderConfigFields.CLIENT_ID, index),
    clientSecret:
      getProviderEnv(provider, ProviderConfigFields.CLIENT_SECRET, index) ??
      getProviderEnv(provider, ProviderConfigFields.SECRET, index),
    name: getProviderEnv(provider, ProviderConfigFields.NAME, index),
    host: getProviderEnv(provider, ProviderConfigFields.HOST, index),
    scope: getProviderEnv(provider, ProviderConfigFields.SCOPE, index),
    audience: getProviderEnv(provider, ProviderConfigFields.AUDIENCE, index),
    tenantId: getProviderEnv(provider, ProviderConfigFields.TENANT_ID, index),
    userFlow: getProviderEnv(provider, ProviderConfigFields.USER_FLOW, index),
    issuer: getProviderEnv(provider, ProviderConfigFields.ISSUER, index),
    adminRoleNames: getProviderEnv(
      provider,
      ProviderConfigFields.ADMIN_ROLE_NAMES,
      index,
    ),
    dialRolesField: getProviderEnv(
      provider,
      ProviderConfigFields.DIAL_ROLES_FIELD,
      index,
    ),
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

  return configs.map(getProviderFromConfig).filter((p) => p !== null);
};

// TODO: create a validator for providers options
const allProviders: (Provider | boolean)[] = getProviders();

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
export const isAuthDisabled: boolean = authProviders.length === 0;
