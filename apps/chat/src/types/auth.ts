import { TokenSet } from 'next-auth';
import { JWT } from 'next-auth/jwt';

import { z as zodValidation } from 'zod';

export interface Token extends JWT {
  providerId?: string;
  userId: string;
  refreshToken: string | TokenSet;
}

export enum SupportedProviders {
  AUTH0 = 'AUTH0',
  AZURE_AD = 'AZURE_AD',
  AZURE_B2C = 'AZURE_B2C',
  COGNITO = 'COGNITO',
  GOOGLE = 'GOOGLE',
  KEYCLOAK = 'KEYCLOAK',
  OKTA = 'OKTA',
  GITLAB = 'GITLAB',
  PING_ID = 'PING_ID',
}

export enum ProviderConfigFields {
  CLIENT_ID = 'CLIENT_ID',
  SECRET = 'SECRET',
  CLIENT_SECRET = 'CLIENT_SECRET',
  NAME = 'NAME',
  HOST = 'HOST',
  SCOPE = 'SCOPE',
  AUDIENCE = 'AUDIENCE',
  TENANT_ID = 'TENANT_ID',
  USER_FLOW = 'USER_FLOW',
  ISSUER = 'ISSUER',
  ADMIN_ROLE_NAMES = 'ADMIN_ROLE_NAMES',
  DIAL_ROLES_FIELD = 'DIAL_ROLES_FIELD',
}

export interface ProviderConfig {
  provider: SupportedProviders;
  id: string;

  clientId: string;
  clientSecret: string;

  name?: string;
  host?: string;
  scope?: string;
  audience?: string;
  tenantId?: string;
  userFlow?: string;
  issuer?: string;

  adminRoleNames?: string;
  dialRolesField?: string;
}

export const providerConfigSchema = zodValidation.object({
  provider: zodValidation.enum(SupportedProviders),
  clientId: zodValidation.string().nonempty(),
  clientSecret: zodValidation.string().nonempty(),

  name: zodValidation.string().optional(),
  host: zodValidation.string().optional(),
  scope: zodValidation.string().optional(),
  audience: zodValidation.string().optional(),
  tenantId: zodValidation.string().optional(),
  userFlow: zodValidation.string().optional(),
  issuer: zodValidation.string().optional(),
  adminRoleName: zodValidation.string().optional(),
  dialRolesField: zodValidation.string().optional(),
});
