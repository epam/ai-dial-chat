import type { EnvironmentVariables } from '../../config/environment.config';
import { AuthProviderId, ProviderConfig } from './provider.types';

const DEFAULT_SCOPE: Record<AuthProviderId, string> = {
  [AuthProviderId.Auth0]: 'openid email profile offline_access',
  [AuthProviderId.AzureAd]: 'openid profile user.Read email offline_access',
  [AuthProviderId.AzureB2c]: 'openid profile email offline_access',
  [AuthProviderId.GitLab]: 'read_user',
  [AuthProviderId.Google]: 'openid email profile offline_access',
  [AuthProviderId.Keycloak]: 'openid email profile offline_access',
  [AuthProviderId.PingId]: 'offline_access',
  [AuthProviderId.Cognito]: 'openid email profile',
  [AuthProviderId.Okta]: 'openid email profile',
};

export const DEFAULT_PROVIDER_LABEL: Record<AuthProviderId, string> = {
  [AuthProviderId.Auth0]: 'Auth0',
  [AuthProviderId.AzureAd]: 'Azure AD',
  [AuthProviderId.AzureB2c]: 'Azure B2C',
  [AuthProviderId.GitLab]: 'GitLab',
  [AuthProviderId.Google]: 'Google',
  [AuthProviderId.Keycloak]: 'Keycloak',
  [AuthProviderId.PingId]: 'PingID',
  [AuthProviderId.Cognito]: 'Cognito',
  [AuthProviderId.Okta]: 'Okta',
};

const requireField = (
  providerLabel: string,
  envVarName: string,
  value: string | undefined,
): string => {
  if (!value) {
    throw new Error(
      `${providerLabel} is configured but ${envVarName} is missing`,
    );
  }
  return value;
};

const resolveAdminRoles = (
  providerRoles: string[] | undefined,
  appWideRoles: string[] | undefined,
): string[] | undefined => providerRoles ?? appWideRoles;

const resolveRolesClaim = (
  providerClaim: string | undefined,
  appWideClaim: string | undefined,
): string | undefined => providerClaim ?? appWideClaim;

const resolvePostLogoutRedirectUri = (env: EnvironmentVariables): string =>
  requireField(
    'A provider',
    'AUTH_POST_LOGOUT_REDIRECT_URI',
    env.AUTH_POST_LOGOUT_REDIRECT_URI,
  );

const buildAuth0Config = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_AUTH0_CLIENT_ID) return undefined;

  const id = AuthProviderId.Auth0;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_AUTH0_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Auth0',
    'AUTH_AUTH0_SECRET',
    env.AUTH_AUTH0_SECRET,
  );
  providerConfig.issuer = `https://${requireField('Auth0', 'AUTH_AUTH0_HOST', env.AUTH_AUTH0_HOST)}/`;
  providerConfig.audience = env.AUTH_AUTH0_AUDIENCE;
  providerConfig.label = env.AUTH_AUTH0_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_AUTH0_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_AUTH0_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_AUTH0_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildAzureAdConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_AZURE_AD_CLIENT_ID) return undefined;

  const id = AuthProviderId.AzureAd;
  const tenantId = requireField(
    'Azure AD',
    'AUTH_AZURE_AD_TENANT_ID',
    env.AUTH_AZURE_AD_TENANT_ID,
  );
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_AZURE_AD_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Azure AD',
    'AUTH_AZURE_AD_SECRET',
    env.AUTH_AZURE_AD_SECRET,
  );
  providerConfig.issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  providerConfig.label = env.AUTH_AZURE_AD_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_AZURE_AD_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_AZURE_AD_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_AZURE_AD_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildAzureB2cConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_AZURE_B2C_CLIENT_ID) return undefined;

  const id = AuthProviderId.AzureB2c;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_AZURE_B2C_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Azure B2C',
    'AUTH_AZURE_B2C_CLIENT_SECRET',
    env.AUTH_AZURE_B2C_CLIENT_SECRET,
  );
  if (env.AUTH_AZURE_B2C_ISSUER) {
    providerConfig.issuer = env.AUTH_AZURE_B2C_ISSUER;
  } else {
    const tenantId = requireField(
      'Azure B2C',
      'AUTH_AZURE_B2C_TENANT_ID',
      env.AUTH_AZURE_B2C_TENANT_ID,
    );
    const userFlow = requireField(
      'Azure B2C',
      'AUTH_AZURE_B2C_USER_FLOW',
      env.AUTH_AZURE_B2C_USER_FLOW,
    );
    providerConfig.issuer = `https://${tenantId}.b2clogin.com/${tenantId}.onmicrosoft.com/${userFlow}/v2.0`;
  }
  providerConfig.label = env.AUTH_AZURE_B2C_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_AZURE_B2C_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_AZURE_B2C_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_AZURE_B2C_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildGitLabConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_GITLAB_CLIENT_ID) return undefined;

  const id = AuthProviderId.GitLab;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_GITLAB_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'GitLab',
    'AUTH_GITLAB_SECRET',
    env.AUTH_GITLAB_SECRET,
  );
  providerConfig.issuer = `https://${requireField('GitLab', 'AUTH_GITLAB_HOST', env.AUTH_GITLAB_HOST)}`;
  providerConfig.label = env.AUTH_GITLAB_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_GITLAB_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_GITLAB_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_GITLAB_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildGoogleConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_GOOGLE_CLIENT_ID) return undefined;

  const id = AuthProviderId.Google;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_GOOGLE_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Google',
    'AUTH_GOOGLE_SECRET',
    env.AUTH_GOOGLE_SECRET,
  );
  providerConfig.issuer = 'https://accounts.google.com';
  providerConfig.label = env.AUTH_GOOGLE_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_GOOGLE_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = env.ADMIN_ROLE_NAMES;
  providerConfig.rolesClaim = env.DIAL_ROLES_FIELD;
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildKeycloakConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_KEYCLOAK_CLIENT_ID) return undefined;

  const id = AuthProviderId.Keycloak;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_KEYCLOAK_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Keycloak',
    'AUTH_KEYCLOAK_SECRET',
    env.AUTH_KEYCLOAK_SECRET,
  );
  providerConfig.issuer = `https://${requireField('Keycloak', 'AUTH_KEYCLOAK_HOST', env.AUTH_KEYCLOAK_HOST)}`;
  providerConfig.label = env.AUTH_KEYCLOAK_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_KEYCLOAK_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_KEYCLOAK_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_KEYCLOAK_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildPingIdConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_PING_ID_CLIENT_ID) return undefined;

  const id = AuthProviderId.PingId;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_PING_ID_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'PingID',
    'AUTH_PING_ID_SECRET',
    env.AUTH_PING_ID_SECRET,
  );
  providerConfig.issuer = `https://${requireField('PingID', 'AUTH_PING_ID_HOST', env.AUTH_PING_ID_HOST)}`;
  providerConfig.label = env.AUTH_PING_ID_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_PING_ID_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_PING_ID_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_PING_ID_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildCognitoConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_COGNITO_CLIENT_ID) return undefined;

  const id = AuthProviderId.Cognito;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_COGNITO_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Cognito',
    'AUTH_COGNITO_SECRET',
    env.AUTH_COGNITO_SECRET,
  );
  providerConfig.issuer = `https://${requireField('Cognito', 'AUTH_COGNITO_HOST', env.AUTH_COGNITO_HOST)}`;
  providerConfig.label = env.AUTH_COGNITO_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_COGNITO_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_COGNITO_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_COGNITO_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

const buildOktaConfig = (
  env: EnvironmentVariables,
): ProviderConfig | undefined => {
  if (!env.AUTH_OKTA_CLIENT_ID) return undefined;

  const id = AuthProviderId.Okta;
  const providerConfig = new ProviderConfig();
  providerConfig.id = id;
  providerConfig.clientId = env.AUTH_OKTA_CLIENT_ID;
  providerConfig.clientSecret = requireField(
    'Okta',
    'AUTH_OKTA_CLIENT_SECRET',
    env.AUTH_OKTA_CLIENT_SECRET,
  );
  providerConfig.issuer = requireField(
    'Okta',
    'AUTH_OKTA_ISSUER',
    env.AUTH_OKTA_ISSUER,
  );
  providerConfig.label = env.AUTH_OKTA_NAME ?? DEFAULT_PROVIDER_LABEL[id];
  providerConfig.scope = env.AUTH_OKTA_SCOPE ?? DEFAULT_SCOPE[id];
  providerConfig.adminRoles = resolveAdminRoles(
    env.AUTH_OKTA_ADMIN_ROLE_NAMES,
    env.ADMIN_ROLE_NAMES,
  );
  providerConfig.rolesClaim = resolveRolesClaim(
    env.AUTH_OKTA_DIAL_ROLES_FIELD,
    env.DIAL_ROLES_FIELD,
  );
  providerConfig.postLogoutRedirectUri = resolvePostLogoutRedirectUri(env);
  return providerConfig;
};

export const buildProviderConfigs = (
  env: EnvironmentVariables,
): ProviderConfig[] =>
  [
    buildAuth0Config(env),
    buildAzureAdConfig(env),
    buildAzureB2cConfig(env),
    buildGitLabConfig(env),
    buildGoogleConfig(env),
    buildKeycloakConfig(env),
    buildPingIdConfig(env),
    buildCognitoConfig(env),
    buildOktaConfig(env),
  ].filter((config): config is ProviderConfig => config !== undefined);
