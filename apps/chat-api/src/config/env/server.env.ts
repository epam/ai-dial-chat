import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CspMode } from '../csp';
import { API_PREFIX_PATTERN, IFRAME_ORIGIN_PATTERN } from './env-patterns';

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
  CSP_MODE?: CspMode = CspMode.Enforce;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    /* Fail closed: this flag relaxes the CSP, so only an explicit truthy value
     * turns it on. */
    return ['true', '1', 'yes'].includes(String(raw).trim().toLowerCase());
  })
  @IsBoolean()
  CSP_ALLOW_STYLE_ATTRIBUTES?: boolean = false;

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

  /*
   * Parses the raw source value: implicit conversion alone would turn an empty
   * `PORT=` into 0 (a random port) instead of failing validation.
   */
  @IsOptional()
  @Transform(({ obj, key }) => parseInt(String(obj[key]), 10))
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT = 5000;

  /*
   * Global route prefix (`<prefix>/v1/...`). One or more URL-safe path
   * segments without leading or trailing slashes.
   */
  @IsOptional()
  @IsString()
  @Matches(API_PREFIX_PATTERN, {
    message:
      'API_PREFIX must be one or more URL-safe path segments (letters, digits, ".", "_", "~", "-") separated by "/", without leading or trailing slashes',
  })
  API_PREFIX = 'api';

  /*
   * Always set after validation: `validate()` falls it back to the required
   * AUTH_CALLBACK_BASE_URL when unset or empty.
   */
  @IsNotEmpty()
  @IsString()
  CORS_ORIGIN!: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  CONVERSATION_BODY_SIZE_LIMIT_BYTES?: number = 10 * 1024 * 1024;
}
