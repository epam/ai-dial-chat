import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LocaleTextEntryDto } from '../../common/dto/locale-text-entry.dto';
import {
  DISPLAY_NAME_PATTERN,
  DISPLAY_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/display-name.pattern';
import {
  LOCALE_CODE_PATTERN,
  LOCALE_CODE_VALIDATION_MESSAGE,
} from '../../common/validators/locale-code.pattern';

export enum ToolsetTransport {
  Http = 'HTTP',
  Sse = 'SSE',
}

export enum ToolsetAuthType {
  None = 'NONE',
  ApiKey = 'API_KEY',
  OAuth = 'OAUTH',
}

/*
 * http(s) or sse URL — allowlist regex so endpoint/URL strings that hit a
 * proxied request or a log line cannot carry unexpected characters.
 */
const ENDPOINT_URL_PATTERN = /^(https?|sse):\/\/[^\s]+$/;
const ENDPOINT_URL_MESSAGE = 'Must be a valid http(s) or sse URL';

const VERSION_PATTERN = /^[\w.+-]{1,64}$/;
const VERSION_MESSAGE =
  'Must contain only word characters, dots, hyphens, and plus signs (max 64 chars)';

const ICON_URL_PATTERN = /^https?:\/\/[^\s]+$/;
const ICON_URL_MESSAGE = 'Must be a valid https?:// URL';

export class ToolsetAuthSettingsBodyDto {
  @ApiProperty({ enum: ToolsetAuthType, example: ToolsetAuthType.None })
  @IsEnum(ToolsetAuthType)
  authenticationType!: ToolsetAuthType;

  @ApiPropertyOptional({ example: 'X-Api-Key' })
  @IsString()
  @IsOptional()
  apiKeyHeader?: string;

  @ApiPropertyOptional({ example: 'my-client-id' })
  @IsString()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ example: 'my-client-secret' })
  @IsString()
  @IsOptional()
  clientSecret?: string;

  @ApiPropertyOptional({ example: 'https://auth.example.com/authorize' })
  @IsString()
  @IsOptional()
  @Matches(ENDPOINT_URL_PATTERN, { message: ENDPOINT_URL_MESSAGE })
  authorizationEndpoint?: string;

  @ApiPropertyOptional({ example: 'https://auth.example.com/token' })
  @IsString()
  @IsOptional()
  @Matches(ENDPOINT_URL_PATTERN, { message: ENDPOINT_URL_MESSAGE })
  tokenEndpoint?: string;

  @ApiPropertyOptional({ type: [String], example: ['read', 'write'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopesSupported?: string[];

  @ApiPropertyOptional({
    example: 'https://chat.example.com/auth/toolset-signin',
  })
  @IsString()
  @IsOptional()
  redirectUri?: string;

  @ApiPropertyOptional({ example: 'S256' })
  @IsString()
  @IsOptional()
  codeChallengeMethod?: string;

  @ApiPropertyOptional({ example: 'abc123' })
  @IsString()
  @IsOptional()
  codeChallenge?: string;
}

export class ToolsetBodyDto {
  @ApiProperty({ example: 'My toolset' })
  @IsString()
  @IsNotEmpty()
  @Matches(DISPLAY_NAME_PATTERN, { message: DISPLAY_NAME_VALIDATION_MESSAGE })
  name!: string;

  @ApiPropertyOptional({ example: '0.0.1' })
  @IsString()
  @IsOptional()
  @Matches(VERSION_PATTERN, { message: VERSION_MESSAGE })
  version?: string;

  @ApiPropertyOptional({ example: 'My toolset description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.svg' })
  @IsString()
  @IsOptional()
  @Matches(ICON_URL_PATTERN, { message: ICON_URL_MESSAGE })
  iconUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['keyword1', 'keyword2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topics?: string[];

  /*
   * Additional (non-primary) locale translations for `name`/`description`.
   * Absent/empty means DIAL Core stores plain strings, unchanged from today.
   */
  @ApiPropertyOptional({ type: () => [LocaleTextEntryDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LocaleTextEntryDto)
  @IsOptional()
  locales?: LocaleTextEntryDto[];

  /*
   * Locale that `name`/`description` are written in. Required when `locales`
   * is non-empty so the backend knows which map key seeds from them;
   * defaults to `'en'` when `locales` is absent.
   */
  @ApiPropertyOptional({ example: 'en' })
  @ValidateIf((o: ToolsetBodyDto) => o.locales != null && o.locales.length > 0)
  @IsString()
  @Matches(LOCALE_CODE_PATTERN, { message: LOCALE_CODE_VALIDATION_MESSAGE })
  primaryLocale?: string;

  /*
   * Empty string is allowed: the toolset editor creates a draft toolset
   * right after its first (General) step, before the endpoint is collected
   * on the second (Settings) step. `ValidateIf` makes every validator below
   * conditional, so a missing `endpoint` (not the same as an empty string)
   * still fails `@IsString()` and is rejected.
   */
  @ApiProperty({ example: 'https://my-toolset.example.com/mcp' })
  @IsString()
  @ValidateIf((o: ToolsetBodyDto) => o.endpoint !== '')
  @Matches(ENDPOINT_URL_PATTERN, { message: ENDPOINT_URL_MESSAGE })
  endpoint!: string;

  @ApiProperty({ enum: ToolsetTransport, example: ToolsetTransport.Http })
  @IsEnum(ToolsetTransport)
  transport!: ToolsetTransport;

  @ApiPropertyOptional({ type: [String], example: ['tool1', 'tool2'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedTools?: string[];

  @ApiPropertyOptional({ example: 'ff5584b7-a82b-4f4f-bf42-5bf74a3893d6' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ type: () => ToolsetAuthSettingsBodyDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ToolsetAuthSettingsBodyDto)
  authSettings!: ToolsetAuthSettingsBodyDto;
}

export class MutatedToolsetDto {
  @ApiProperty({
    example: 'toolsets/encrypted-bucket/My%20toolset__0.0.1',
  })
  id!: string;
}
