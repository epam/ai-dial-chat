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
  MaxLength,
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
  PORT?: number = 5000;

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
  @IsUrl({ require_tld: false })
  MCP_APP_SANDBOX_URL?: string;

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
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  AUTH_COOKIE_SECURE?: boolean = true;

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  AUTH_CALLBACK_BASE_URL!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  AUTH_POST_LOGOUT_REDIRECT_URI?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return ['admin'];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  ADMIN_ROLE_NAMES?: string[] = ['admin'];

  @IsOptional()
  @IsString()
  DIAL_ROLES_FIELD?: string = 'dial_roles';

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

  // Header bearer-token authentication (off by default; see auth-provider-env-config spec)
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  AUTH_HEADER_TOKEN_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  AUTH_HEADER_TOKEN_ALLOWED_ISSUERS?: string[];

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  AUTH_HEADER_TOKEN_CLOCK_TOLERANCE_SECONDS?: number = 30;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  AUTH_HEADER_TOKEN_JWKS_CACHE_TTL_SECONDS?: number = 600;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  AUTH_HEADER_TOKEN_BUCKET_CACHE_TTL_SECONDS?: number = 60;

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
  DEEP_RESEARCH_TOOL_ID?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_HTML_MESSAGE?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_TITLE?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_DESCRIPTION?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENTS?: string;

  @IsOptional()
  @IsString()
  FOOTER_HTML_MESSAGE?: string;

  /* Deliberately unconstrained: this is an opaque display string that never
   * reaches a filesystem path, an outbound URL, or a log line, and CI stamps
   * take many shapes (0.45.0, 0.45.0-rc.3, 2026.08.10+a1b2c3d). */
  @IsOptional()
  @IsString()
  CHAT_VERSION?: string;

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
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  CONVERSATION_BODY_SIZE_LIMIT_BYTES?: number = 10 * 1024 * 1024;

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
    /* Reads the raw source value (not `value`, which class-transformer's
     * `enableImplicitConversion` may have already coerced to `true` for any
     * non-empty string, including the literal string "false") so an env var
     * explicitly set to "false"/"0"/"no" parses to `false` as intended. */
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  OVERLAY_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  OVERLAY_SANDBOX_ENABLED?: boolean = false;

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

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return null;
    const parts = String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    return parts.length > 0 ? parts : null;
  })
  @IsString({ each: true })
  ENABLED_UI_FEATURES?: string[] | null = null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  LIVE_CHAT_INTERACTION_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  LIVE_CHAT_INTERACTION_ENABLED_ROLES?: string[] = [];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return undefined;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no'].includes(String(value).toLowerCase());
  })
  @IsBoolean()
  SCHEDULED_TASKS_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  SCHEDULED_TASKS_ENABLED_ROLES?: string[] = [];

  @IsOptional()
  @IsString()
  SCHEDULER_APP_ID?: string;

  @IsOptional()
  @IsString()
  SCHEDULER_SERVICE_ID?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1000)
  SCHEDULER_SERVICE_TIMEOUT_MS?: number = 10_000;

  @IsOptional()
  @IsString()
  CUSTOM_VISUALIZERS?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  PUBLICATION_FILTER_SOURCES?: string[] = [];
}
