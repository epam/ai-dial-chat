import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ManagedConfigMode } from '../../app-config/managed-runtime/managed-runtime.types';
import { canonicalAppId } from './app-ids';
import {
  APP_ID_PATTERN,
  MANAGED_CONFIG_INSTANCE_ID_PATTERN,
} from './env-patterns';

/** The most `appId=instanceId` pairs one deployment may map. */
export const MAX_MANAGED_CONFIG_INSTANCES = 16;

/* One `appId=instanceId` pair, both parts already trimmed. */
const MANAGED_CONFIG_INSTANCE_PAIR_PATTERN = new RegExp(
  `^${APP_ID_PATTERN.source.slice(1, -1)}=${MANAGED_CONFIG_INSTANCE_ID_PATTERN.source.slice(1, -1)}$`,
);

/* Splits a comma-separated list, trimming entries and dropping blank ones. */
const parseCommaList = (value: unknown): string[] =>
  String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/* Trims each side of every pair and replaces the legacy application
 * identifier, so the cross-variable checks see only canonical identifiers. */
const parsePairList = (value: unknown): string[] =>
  parseCommaList(value).map((pair) => {
    const [appId = '', ...rest] = pair.split('=').map((part) => part.trim());
    return [canonicalAppId(appId), ...rest].join('=');
  });

/*
 * Reading published Config Studio snapshots through DIAL Core. Every value
 * is inert while MANAGED_CONFIG_MODE is `off`; the rules that relate these
 * variables to each other and to CLIENT_CONFIG_APP_IDS are checked by
 * `validateManagedRuntimeEnvironment` after this class validates.
 */
export class ManagedConfigEnv {
  @IsOptional()
  @IsEnum(ManagedConfigMode, {
    message: 'MANAGED_CONFIG_MODE must be one of: off, shadow, active',
  })
  MANAGED_CONFIG_MODE?: ManagedConfigMode = ManagedConfigMode.Off;

  /* `appId=instanceId` pairs: which Config Studio instance each served
   * application identifier reads. Only this trusted mapping names an
   * instance; no request input can. */
  @IsOptional()
  @Transform(({ value }) => (value == null ? [] : parsePairList(value)))
  @IsArray()
  @ArrayMaxSize(MAX_MANAGED_CONFIG_INSTANCES, {
    message: `MANAGED_CONFIG_INSTANCES must list at most ${MAX_MANAGED_CONFIG_INSTANCES} pairs`,
  })
  @Matches(MANAGED_CONFIG_INSTANCE_PAIR_PATTERN, {
    each: true,
    message:
      'Each MANAGED_CONFIG_INSTANCES entry must be appId=instanceId, with a lowercase application identifier and a DIAL deployment ID',
  })
  MANAGED_CONFIG_INSTANCES?: string[] = [];

  /* Chat's own Core API key for the runtime read. Its Core roles must be in
   * each instance's userRoles and readerRoles. Server-only; never logged. */
  @IsOptional()
  @IsString()
  MANAGED_CONFIG_API_KEY?: string;

  /* How long a snapshot stays usable after its last successful
   * verification. No default: the value is an operator decision. */
  @IsOptional()
  // Preserve fractional or malformed values so validation rejects them.
  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'MANAGED_CONFIG_MAX_STALENESS_SECONDS must be an integer' })
  @Max(86_400, {
    message: 'MANAGED_CONFIG_MAX_STALENESS_SECONDS must be at most 86400',
  })
  MANAGED_CONFIG_MAX_STALENESS_SECONDS?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({
    message: 'MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS must be an integer',
  })
  @Min(15, {
    message: 'MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS must be at least 15',
  })
  @Max(3_600, {
    message: 'MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS must be at most 3600',
  })
  MANAGED_CONFIG_REFRESH_INTERVAL_SECONDS?: number = 60;

  /* The interval browsers refresh client config at while a tab is visible,
   * sent to them as `metadata.nextRefreshAt`. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt({
    message: 'MANAGED_CONFIG_CLIENT_REFRESH_SECONDS must be an integer',
  })
  @Min(30, {
    message: 'MANAGED_CONFIG_CLIENT_REFRESH_SECONDS must be at least 30',
  })
  @Max(900, {
    message: 'MANAGED_CONFIG_CLIENT_REFRESH_SECONDS must be at most 900',
  })
  MANAGED_CONFIG_CLIENT_REFRESH_SECONDS?: number = 120;

  /* Full registry keys whose managed value or policy applies in `active`
   * mode. Every other key keeps its environment behavior. */
  @IsOptional()
  @Transform(({ value }) =>
    value == null ? [] : [...new Set(parseCommaList(value))],
  )
  @IsArray()
  @IsString({ each: true })
  MANAGED_CONFIG_ACTIVE_KEYS?: string[] = [];

  /* When set, a snapshot's recorded environment must equal it. */
  @IsOptional()
  @Matches(APP_ID_PATTERN, {
    message:
      'MANAGED_CONFIG_ENVIRONMENT must be a lowercase identifier of 1-63 characters',
  })
  MANAGED_CONFIG_ENVIRONMENT?: string;
}
