import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ToolsetAuthType } from './toolset-body.dto';

export enum ToolsetCredentialsLevel {
  Global = 'GLOBAL',
  User = 'USER',
  App = 'APP',
}

/*
 * Allowlist for the toolset reference/url the client submits. Kept for
 * backward compatibility with existing clients and written to log lines, but
 * the service derives the actual url sent to DIAL Core from the trusted
 * `toolsetName` route parameter rather than this field — see
 * `resolveToolsetLoginUrl` in `toolsets.service.ts`. Mirrors the
 * deployment-id character set.
 */
const TOOLSET_URL_PATTERN = /^(?:[\w.\-:@/]|%[\dA-Fa-f]{2})+$/;
const TOOLSET_URL_MESSAGE =
  'Must contain only supported characters or valid percent-encoded bytes';

export class ToolsetLoginBodyDto {
  @ApiProperty({ example: 'toolsets/encrypted-bucket/My%20toolset__0.0.1' })
  @IsString()
  @Matches(TOOLSET_URL_PATTERN, { message: TOOLSET_URL_MESSAGE })
  url!: string;

  @ApiProperty({
    enum: ToolsetCredentialsLevel,
    example: ToolsetCredentialsLevel.User,
  })
  @IsEnum(ToolsetCredentialsLevel)
  credentialsLevel!: ToolsetCredentialsLevel;

  @ApiProperty({ enum: ToolsetAuthType, example: ToolsetAuthType.ApiKey })
  @IsEnum(ToolsetAuthType)
  authenticationType!: ToolsetAuthType;

  @ApiPropertyOptional({ description: 'API key value (API_KEY auth).' })
  @ValidateIf(
    (body: ToolsetLoginBodyDto) =>
      body.authenticationType === ToolsetAuthType.ApiKey,
  )
  @IsString()
  @IsNotEmpty()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'OAuth authorization code (OAUTH auth).',
  })
  @ValidateIf(
    (body: ToolsetLoginBodyDto) =>
      body.authenticationType === ToolsetAuthType.OAuth,
  )
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description: 'OAuth redirect URI used for the code exchange.',
  })
  @ValidateIf(
    (body: ToolsetLoginBodyDto) =>
      body.authenticationType === ToolsetAuthType.OAuth,
  )
  @IsString()
  @IsNotEmpty()
  redirectUri?: string;

  /*
   * Whether the user permits an application to use this toolset credential
   * while they are NOT present. DIAL Core records it on the credential and
   * gates every on-behalf-of mint on it, so a toolset signed in without it
   * works interactively and still fails with `consent-required` the moment an
   * application reaches for it in the background.
   *
   * Optional and defaulted by the caller, never by this DTO: standing consent
   * has to be a choice the user actually made.
   */
  @ApiPropertyOptional({
    description:
      'Whether the user consents to an application using this credential while ' +
      'they are offline. Required for on-behalf-of use (e.g. scheduled runs).',
  })
  @IsOptional()
  @IsBoolean()
  offlineUsageConsent?: boolean;
}

export class ToolsetLogoutBodyDto {
  @ApiProperty({ example: 'toolsets/encrypted-bucket/My%20toolset__0.0.1' })
  @IsString()
  @Matches(TOOLSET_URL_PATTERN, { message: TOOLSET_URL_MESSAGE })
  url!: string;

  @ApiProperty({
    enum: ToolsetCredentialsLevel,
    example: ToolsetCredentialsLevel.User,
  })
  @IsEnum(ToolsetCredentialsLevel)
  credentialsLevel!: ToolsetCredentialsLevel;

  @ApiPropertyOptional({
    enum: ToolsetAuthType,
    example: ToolsetAuthType.OAuth,
    description:
      'Authentication type used by the toolset. Optional — a caller that ' +
      "doesn't already have this loaded (e.g. logging out by id alone) can " +
      "omit it; the server looks up the toolset's own stored authentication " +
      'type instead.',
  })
  @IsOptional()
  @IsEnum(ToolsetAuthType)
  authenticationType?: ToolsetAuthType;
}

export class ToolsetAuthResultDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
