import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  IsCatalogCreationRoles,
  parseCatalogCreationRoles,
  type CatalogCreationRolesConfig,
} from '../catalog-creation.types';

/** Feature gates (`*_ENABLED`, `*_ENABLED_ROLES`) and usage-limit controls. */
export class FeatureFlagsEnv {
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  LLM_CONVERSATION_NAMING_ENABLED?: boolean = false;

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

  /*
   * Server-only creation policy, independent of ENABLED_UI_FEATURES: role
   * lists by creation type and by exact application schema id, e.g.
   * `{"types":{"skill":["authors"]},"schemas":{"<schema id>":["team-A"]}}`.
   * Absent or blank means no restriction. Only the shape is checked here;
   * AppConfigService normalizes the role lists once at startup. Never sent to
   * the browser — client-config carries only the evaluated permissions.
   */
  @Transform(({ obj, key }) =>
    parseCatalogCreationRoles((obj as Record<string, unknown>)[key]),
  )
  @IsCatalogCreationRoles()
  CATALOG_CREATION_ROLES: CatalogCreationRolesConfig = {
    types: {},
    schemas: {},
  };

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  LIVE_CHAT_INTERACTION_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    /* Reads the raw source value (not `value`, which class-transformer's
     * enableImplicitConversion may have already coerced to `true` for any
     * non-empty string, including the literal string "false") so an env var
     * explicitly set to "false"/"0"/"no" parses to `false` as intended. */
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  RESPONSES_API_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    /* Same raw-value coercion as RESPONSES_API_ENABLED, so the literal
     * string "false" parses to `false`. */
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  RESPONSES_BACKGROUND_ENABLED?: boolean = false;

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
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
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
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  PROJECTS_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  PROJECTS_ENABLED_ROLES?: string[] = [];

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  USAGE_LIMITS_CONTROL_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  ORG_UNITS_ENABLED?: boolean = false;

  /*
   * Percentage of a capped day/week/month usage limit at which the composer's
   * usage banner appears. Banner only — the usage dial keeps its fixed 75%.
   */
  @IsOptional()
  // Preserve fractional or malformed values so validation rejects them.
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(99)
  USAGE_LIMITS_WARNING_THRESHOLD_PERCENT?: number = 75;
}
