import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

/** Per-identity-provider OIDC settings (`AUTH_<PROVIDER>_*`). */
export class AuthProvidersEnv {
  // Auth providers
  @IsOptional()
  @IsString()
  AUTH_AUTH0_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_AUTH0_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_AUTH0_HOST?: string;

  @IsOptional()
  @IsString()
  AUTH_AUTH0_AUDIENCE?: string;

  @IsOptional()
  @IsString()
  AUTH_AUTH0_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_AUTH0_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_AUTH0_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_AUTH0_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_TENANT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_AZURE_AD_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_AZURE_AD_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_TENANT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_USER_FLOW?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_ISSUER?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_AZURE_B2C_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_AZURE_B2C_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_GITLAB_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_GITLAB_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_GITLAB_HOST?: string;

  @IsOptional()
  @IsString()
  AUTH_GITLAB_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_GITLAB_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_GITLAB_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_GITLAB_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_GOOGLE_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_GOOGLE_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_GOOGLE_SCOPE?: string;

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_HOST?: string;

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_KEYCLOAK_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_KEYCLOAK_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_PING_ID_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_PING_ID_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_PING_ID_HOST?: string;

  @IsOptional()
  @IsString()
  AUTH_PING_ID_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_PING_ID_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_PING_ID_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_PING_ID_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_COGNITO_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_COGNITO_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_COGNITO_HOST?: string;

  @IsOptional()
  @IsString()
  AUTH_COGNITO_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_COGNITO_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_COGNITO_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_COGNITO_DIAL_ROLES_FIELD?: string;

  @IsOptional()
  @IsString()
  AUTH_OKTA_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  AUTH_OKTA_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_OKTA_ISSUER?: string;

  @IsOptional()
  @IsString()
  AUTH_OKTA_NAME?: string;

  @IsOptional()
  @IsString()
  AUTH_OKTA_SCOPE?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsOptional()
  @IsString({ each: true })
  AUTH_OKTA_ADMIN_ROLE_NAMES?: string[];

  @IsOptional()
  @IsString()
  AUTH_OKTA_DIAL_ROLES_FIELD?: string;
}
