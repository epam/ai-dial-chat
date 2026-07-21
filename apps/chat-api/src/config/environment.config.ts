import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum ApplicationLogLevel {
  Debug = 'debug',
  Log = 'log',
  Warn = 'warn',
  Error = 'error',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(ApplicationLogLevel)
  LOG_LEVEL?: ApplicationLogLevel;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT?: number = 3005;

  @IsOptional()
  @IsString()
  API_PREFIX?: string = 'api';

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string = 'http://localhost:4207';

  @IsNotEmpty()
  @IsString()
  DIAL_CORE_URL!: string;

  @IsOptional()
  @IsString()
  DIAL_CORE_EXTERNAL_URL?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}(-preview)?$/, {
    message:
      'DIAL_API_VERSION must follow the YYYY-MM-DD or YYYY-MM-DD-preview format',
  })
  DIAL_API_VERSION?: string = '2024-10-21';

  @IsOptional()
  @IsString()
  DIAL_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  THEMES_CONFIG_URL?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  THEMES_SERVICE_TIMEOUT_MS?: number = 5000;

  // Auth / session
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/i, {
    message: 'AUTH_SESSION_SECRET must be a 64-character hex string (32 bytes)',
  })
  AUTH_SESSION_SECRET!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/i, {
    message:
      'AUTH_SESSION_PREV_SECRET must be a 64-character hex string (32 bytes)',
  })
  AUTH_SESSION_PREV_SECRET?: string;

  @IsOptional()
  @IsString()
  AUTH_SESSION_COOKIE_NAME?: string = '__Host-chat.sess';

  @IsOptional()
  @IsString()
  AUTH_TRANSACTION_COOKIE_NAME?: string = '__Host-chat.tx';

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  AUTH_COOKIE_SECURE?: boolean = true;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  AUTH_CALLBACK_BASE_URL!: string;

  @IsNotEmpty()
  @IsString()
  AUTH_PROVIDERS!: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  FILE_UPLOAD_MAX_BYTES?: number = 536_870_912;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  FILE_TRANSFER_TIMEOUT_MS?: number = 30_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_ITEMS?: number = 100;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_FILES?: number = 1000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_MAX_UNCOMPRESSED_BYTES?: number = 5_368_709_120;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_TIMEOUT_MS?: number = 300_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(32)
  ARCHIVE_DOWNLOAD_CONCURRENCY?: number = 32;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_BYTES?: number = 536_870_912;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_FILES?: number = 1000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES?: number = 2_147_483_648;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  ARCHIVE_UPLOAD_TIMEOUT_MS?: number = 300_000;

  @IsOptional()
  @IsString()
  DEFAULT_DEPLOYMENT?: string;

  @IsOptional()
  @IsString()
  ASR_MODEL?: string;

  @IsOptional()
  @IsString()
  UTILITY_MODEL?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  LLM_CONVERSATION_NAMING_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  UTILITY_NAMING_TIMEOUT_MS?: number = 10_000;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  TRANSCRIBE_SIZE_LIMIT_BYTES?: number = 5 * 1024 * 1024;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  ASR_ENABLED_ROLES?: string[] = [];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  FEATURED_MODEL_IDS?: string[] = [];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  HIDDEN_ENTITY_TAGS?: string[] = [];

  @IsOptional()
  @IsUrl({ require_tld: false })
  DEV_QUICKAPPS_EDITOR_URL?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['https', 'http'],
    },
    { each: true },
  )
  @Matches(/^https?:\/\/[^/\s?#]+$/, {
    each: true,
    message:
      'Each allowed iframe origin must be an origin URL with no path or query string',
  })
  ALLOWED_IFRAME_ORIGINS?: string[] = [];

  @IsOptional()
  @Transform(({ obj, key }) => {
    // Reads the raw source value (not `value`, which class-transformer's
    // `enableImplicitConversion` may have already coerced to `true` for any
    // non-empty string, including the literal string "false") so an env var
    // explicitly set to "false"/"0"/"no" parses to `false` as intended.
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  OVERLAY_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  FILE_MANAGER_AVAILABLE_TABS?: string[] = [];
}
