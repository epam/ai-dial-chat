import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
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

  // TODO: Make required when @epam/ai-dial-typescript-sdk is available
  @IsOptional()
  @IsUrl({ require_tld: false })
  DIAL_CORE_URL?: string;

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

  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  AUTH_CALLBACK_BASE_URL!: string;

  @IsNotEmpty()
  @IsString()
  AUTH_PROVIDERS!: string;
}
