import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ExternalServiceAuthType } from './external-service.dto';

/** The kinds of service an application may declare: an API-key vault or an OAuth client. */
export const DECLARABLE_EXTERNAL_SERVICE_AUTH_TYPES = [
  ExternalServiceAuthType.ApiKey,
  ExternalServiceAuthType.OAuth,
] as const;

/** An HTTP header name: RFC 7230 token characters only, so it cannot smuggle a second header. */
const HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;
/** An OAuth scope: printable ASCII without spaces, quotes or backslashes (RFC 6749 §3.3). */
const SCOPE_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]+$/;

export class ExternalServiceAuthSettingsBodyDto {
  @ApiProperty({
    enum: DECLARABLE_EXTERNAL_SERVICE_AUTH_TYPES,
    example: ExternalServiceAuthType.ApiKey,
  })
  @IsIn(DECLARABLE_EXTERNAL_SERVICE_AUTH_TYPES)
  authenticationType!: (typeof DECLARABLE_EXTERNAL_SERVICE_AUTH_TYPES)[number];

  @ApiPropertyOptional({
    description:
      'API_KEY: the header the stored key is sent under. The key itself is never part of the definition.',
    example: 'PRIVATE-TOKEN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(HEADER_NAME_PATTERN, {
    message: 'apiKeyHeader must be a header name',
  })
  apiKeyHeader?: string;

  @ApiPropertyOptional({
    description: 'OAUTH: the client id.',
    example: 'dial-loop',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  clientId?: string;

  @ApiPropertyOptional({
    description:
      'OAUTH: the client secret. Write-only: never returned, never logged.',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  clientSecret?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/oauth/authorize' })
  @IsOptional()
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  authorizationEndpoint?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/oauth/token' })
  @IsOptional()
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
    require_tld: false,
  })
  tokenEndpoint?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['openid', 'offline_access'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  @Matches(SCOPE_PATTERN, {
    each: true,
    message: 'each scope must be an OAuth scope token',
  })
  scopesSupported?: string[];
}

/** The body of `PUT /api/v1/external-services/{appId}/{serviceId}`: one service of the application. */
export class ExternalServiceDefinitionBodyDto {
  @ApiProperty({ example: 'GitLab (PAT)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  displayName!: string;

  @ApiPropertyOptional({ example: 'The project’s GitLab token' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  description?: string;

  @ApiProperty({ type: ExternalServiceAuthSettingsBodyDto })
  @ValidateNested()
  @Type(() => ExternalServiceAuthSettingsBodyDto)
  authSettings!: ExternalServiceAuthSettingsBodyDto;
}
