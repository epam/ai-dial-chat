import {
  IsArray,
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
} from 'class-validator';

export enum AuthProviderId {
  Auth0 = 'auth0',
  AzureAd = 'azure-ad',
  AzureB2c = 'azure-b2c',
  GitLab = 'gitlab',
  Google = 'google',
  Keycloak = 'keycloak',
  PingId = 'ping-id',
  Cognito = 'cognito',
  Okta = 'okta',
}

export class ProviderConfig {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'Provider id must match /^[a-z0-9][a-z0-9-]*$/',
  })
  id!: string;

  @IsString()
  @IsNotEmpty()
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @IsString()
  @IsNotEmpty()
  scope!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  rolesClaim?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  adminRoles?: string[];

  @IsString()
  @IsNotEmpty()
  postLogoutRedirectUri!: string;
}
