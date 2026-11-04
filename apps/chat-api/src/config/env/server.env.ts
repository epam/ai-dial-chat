import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';
import { CspMode } from '../csp';
import { IFRAME_ORIGIN_PATTERN } from './env-patterns';

export enum ApplicationLogLevel {
  Debug = 'debug',
  Log = 'log',
  Warn = 'warn',
  Error = 'error',
}

/** HTTP server, CORS, CSP and logging settings. */
export class ServerEnv {
  @IsOptional()
  @IsEnum(CspMode)
  CSP_MODE?: CspMode = CspMode.ReportOnly;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['https'],
    disallow_auth: true,
  })
  @Matches(/^https:\/\/[^\s";,\\<>#]+$/, {
    message: 'CSP_REPORT_URI must be an HTTPS URL safe for CSP headers',
  })
  CSP_REPORT_URI?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  })
  @Matches(IFRAME_ORIGIN_PATTERN, {
    each: true,
    message:
      'Each ALLOWED_CONNECT_ORIGINS entry must be an HTTP(S) origin (scheme://host[:port]) or a single leading-wildcard-label origin, without paths, queries, or fragments',
  })
  ALLOWED_CONNECT_ORIGINS?: string[] = [];

  @IsOptional()
  @IsEnum(ApplicationLogLevel)
  LOG_LEVEL?: ApplicationLogLevel;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT?: number = 5000;

  @IsOptional()
  @IsString()
  API_PREFIX?: string = 'api';

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  CONVERSATION_BODY_SIZE_LIMIT_BYTES?: number = 10 * 1024 * 1024;
}
