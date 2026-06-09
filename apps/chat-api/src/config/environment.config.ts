import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';

export class EnvironmentVariables {
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
  @Matches(/^\d{4}-\d{2}-\d{2}(-preview)?$/, {
    message:
      'DIAL_API_VERSION must follow the YYYY-MM-DD or YYYY-MM-DD-preview format',
  })
  DIAL_API_VERSION?: string = '2024-10-21';

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
  @IsString()
  ASR_MODEL?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  TRANSCRIBE_SIZE_LIMIT_BYTES?: number = 5 * 1024 * 1024;
}
