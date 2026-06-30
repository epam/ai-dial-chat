import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ToolsetAuthType } from './toolset-body.dto';

export enum ToolsetCredentialsLevel {
  Global = 'GLOBAL',
  User = 'USER',
  App = 'APP',
}

// Allowlist for the toolset reference/url that is forwarded to DIAL Core and
// written to log lines. Mirrors the deployment-id character set.
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
  @IsString()
  @IsOptional()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'OAuth authorization code (OAUTH auth).',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({
    description: 'OAuth redirect URI used for the code exchange.',
  })
  @IsString()
  @IsOptional()
  redirectUri?: string;
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

  @ApiProperty({ enum: ToolsetAuthType, example: ToolsetAuthType.OAuth })
  @IsEnum(ToolsetAuthType)
  authenticationType!: ToolsetAuthType;
}

export class ToolsetAuthResultDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
