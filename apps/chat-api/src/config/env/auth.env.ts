import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  DeploymentType,
  normalizeDeploymentTypesInput,
} from '../../deployments/dto/deployment-type';

/** Session, cookie, role and header-token authentication settings. */
export class AuthEnv {
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
  // Preserve fractional or malformed values so validation rejects them.
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(2147483647)
  AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

  @IsOptional()
  @IsString()
  AUTH_SESSION_COOKIE_NAME?: string = '__Host-chat.sess';

  @IsOptional()
  @IsString()
  AUTH_TRANSACTION_COOKIE_NAME?: string = '__Host-chat.tx';

  /*
   * Names of cookies set by a previously deployed auth stack (e.g. NextAuth's
   * `next-auth.session-token`) that must be actively expired on this
   * deployment. The old service is gone, so only this one can ever issue the
   * `Max-Age=0` response that removes them from the browser.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  AUTH_LEGACY_COOKIE_NAMES?: string[];

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

  /*
   * Deployment kinds `GET /user/limits` and `GET /user/usage` report when the
   * request names none, forwarded to DIAL Core as `deploymentTypes`. Defaults
   * to models and applications, so Settings → Usage shows the spend DIAL Core
   * attributes to routers; `model` restores the model-only report.
   */
  @IsOptional()
  @Transform(({ value }) => {
    const normalized = normalizeDeploymentTypesInput(value ?? '');
    return Array.isArray(normalized) && normalized.length === 0
      ? [DeploymentType.Model, DeploymentType.Application]
      : normalized;
  })
  @IsArray()
  @IsEnum(DeploymentType, { each: true })
  USER_USAGE_DEPLOYMENT_TYPES?: DeploymentType[] = [
    DeploymentType.Model,
    DeploymentType.Application,
  ];

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
}
