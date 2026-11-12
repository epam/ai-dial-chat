import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

/** DIAL Core connection, themes service and MCP app sandbox settings. */
export class DialEnv {
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
  @Matches(/^(light|dark)$/)
  MCP_APP_THEME?: 'light' | 'dark';

  @IsOptional()
  @IsString()
  MCP_APP_USER_AGENT?: string;

  @IsOptional()
  @IsString()
  MCP_APP_HOST_NAME?: string;

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

  /**
   * Server-only `Api-Key` for `GET /api/v1/model-catalog`. Separate from
   * `DIAL_API_KEY`: its Core role must see every catalog model. Unset or blank
   * disables the catalog routes.
   */
  @IsOptional()
  @IsString()
  MODEL_CATALOG_API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  THEMES_CONFIG_URL?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  THEMES_SERVICE_TIMEOUT_MS?: number = 5000;
}
