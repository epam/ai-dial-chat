import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export enum ExternalServiceAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

export enum ExternalServiceCredentialsLevel {
  Global = 'GLOBAL',
  Application = 'APPLICATION',
  User = 'USER',
}

export class GetExternalServiceResponseDto {
  @ApiProperty({ example: 'FinHub API' })
  displayName!: string;

  @ApiPropertyOptional({ example: 'Financial data lookup service' })
  description?: string;

  @ApiProperty({
    enum: ExternalServiceAuthType,
    example: ExternalServiceAuthType.ApiKey,
  })
  authenticationType!: ExternalServiceAuthType;

  @ApiPropertyOptional({
    example: 'SIGNED_IN',
    description:
      "USER-level credential status ('SIGNED_IN' | 'SIGNED_OUT' | 'FAILED'), when Core reports one.",
  })
  userLevelAuthStatus?: string;

  @ApiPropertyOptional({
    example: 'SIGNED_OUT',
    description:
      "GLOBAL-level credential status ('SIGNED_IN' | 'SIGNED_OUT' | 'FAILED'), when Core reports one.",
  })
  globalAuthStatus?: string;

  /* OAuth client config — only present when authenticationType is OAUTH. */

  @ApiPropertyOptional({ example: 'my-client-id' })
  clientId?: string;

  @ApiPropertyOptional({ example: 'https://auth.example.com/authorize' })
  authorizationEndpoint?: string;

  @ApiPropertyOptional({ type: [String], example: ['read', 'write'] })
  scopesSupported?: string[];

  @ApiPropertyOptional({ example: 'abc123' })
  codeChallenge?: string;

  @ApiPropertyOptional({ example: 'S256' })
  codeChallengeMethod?: string;
}

export class ExternalServiceSigninBodyDto {
  @ApiProperty({
    enum: ExternalServiceCredentialsLevel,
    example: ExternalServiceCredentialsLevel.User,
  })
  @IsEnum(ExternalServiceCredentialsLevel)
  credentialsLevel!: ExternalServiceCredentialsLevel;

  @ApiProperty({
    enum: ExternalServiceAuthType,
    example: ExternalServiceAuthType.ApiKey,
  })
  @IsEnum(ExternalServiceAuthType)
  authenticationType!: ExternalServiceAuthType;

  @ApiPropertyOptional({ description: 'API key value (API_KEY auth).' })
  @ValidateIf(
    (body: ExternalServiceSigninBodyDto) =>
      body.authenticationType === ExternalServiceAuthType.ApiKey,
  )
  @IsString()
  @IsNotEmpty()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'OAuth authorization code (OAUTH auth).',
  })
  @ValidateIf(
    (body: ExternalServiceSigninBodyDto) =>
      body.authenticationType === ExternalServiceAuthType.OAuth,
  )
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description: 'OAuth redirect URI used for the code exchange.',
  })
  @ValidateIf(
    (body: ExternalServiceSigninBodyDto) =>
      body.authenticationType === ExternalServiceAuthType.OAuth,
  )
  @IsString()
  @IsNotEmpty()
  redirectUri?: string;

  /*
   * Whether the user permits the application to use this credential while they
   * are not present. Core records it on the credential and gates every
   * on-behalf-of mint on it, so a credential signed in without it fails with
   * `consent-required` the moment an application uses it in the background.
   *
   * Optional and defaulted by the caller, never by this DTO: standing consent
   * has to be a choice the user actually made.
   */
  @ApiPropertyOptional({
    description:
      'Whether the user consents to the application using this credential while ' +
      'they are offline. Required for on-behalf-of use (e.g. scheduled runs).',
  })
  @IsOptional()
  @IsBoolean()
  offlineUsageConsent?: boolean;
}

export class ExternalServiceLogoutBodyDto {
  @ApiProperty({
    enum: ExternalServiceCredentialsLevel,
    example: ExternalServiceCredentialsLevel.User,
  })
  @IsEnum(ExternalServiceCredentialsLevel)
  credentialsLevel!: ExternalServiceCredentialsLevel;

  @ApiProperty({
    enum: ExternalServiceAuthType,
    example: ExternalServiceAuthType.ApiKey,
  })
  @IsEnum(ExternalServiceAuthType)
  authenticationType!: ExternalServiceAuthType;
}

export class ExternalServiceAuthResultDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
