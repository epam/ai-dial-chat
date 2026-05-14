import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
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
  @IsUrl({ require_tld: false })
  DIAL_CORE_URL!: string;

  @IsNotEmpty()
  @IsString()
  DIAL_API_KEY!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  THEMES_CONFIG_URL?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  THEMES_SERVICE_TIMEOUT_MS?: number = 5000;
}
