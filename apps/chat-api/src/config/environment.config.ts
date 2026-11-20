import { IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CELEBRATION_DELIVERY_REVISION_PATTERN,
  CELEBRATION_EVENT_ID_PATTERN,
  CELEBRATION_ID_MAX_LENGTH,
  CELEBRATION_POLICY_MAX_ENTRIES,
  CELEBRATION_SCENE_PAIR_PATTERN,
  CelebrationDeliveryMode,
} from '../app-config/types/celebration-delivery';
import { AuthProvidersEnv } from './env/auth-providers.env';
import { AuthEnv } from './env/auth.env';
import { ClientUiEnv } from './env/client-ui.env';
import { DialEnv } from './env/dial.env';
import { FeatureFlagsEnv } from './env/feature-flags.env';
import { FilesEnv } from './env/files.env';
import { GenerationEnv } from './env/generation.env';
import { IntegrationsEnv } from './env/integrations.env';
import { ManagedConfigEnv } from './env/managed-config.env';
import { ServerEnv } from './env/server.env';

export { IFRAME_ORIGIN_PATTERN } from './env/env-patterns';
export { ApplicationLogLevel } from './env/server.env';

const EVENT_ID_REGEXP = new RegExp(CELEBRATION_EVENT_ID_PATTERN);
const SCENE_PAIR_REGEXP = new RegExp(CELEBRATION_SCENE_PAIR_PATTERN);
const DELIVERY_REVISION_REGEXP = new RegExp(
  CELEBRATION_DELIVERY_REVISION_PATTERN,
);

/* Splits a comma-separated list, dropping blanks and repeats, so the
 * 64-entry limit counts distinct entries. */
const parseCelebrationList = (value: unknown): string[] | undefined => {
  if (value == null || value === '') return undefined;
  const entries = Array.isArray(value) ? value : String(value).split(',');
  return [
    ...new Set(
      entries
        .map((entry: unknown) => String(entry).trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
};

/**
 * The validated chat-api environment. Each domain declares its own vars in
 * `config/env/<domain>.env.ts`; add a new var to the class it belongs to, not
 * here. `validation.ts` validates against this composed class, and services
 * inject `ConfigService<EnvironmentVariables>`.
 *
 * The celebration (`UI_EVENT*`) vars are the one exception: the celebration
 * feature is still under development, so they stay declared here unchanged.
 */
export class EnvironmentVariables extends IntersectionType(
  ServerEnv,
  DialEnv,
  AuthEnv,
  AuthProvidersEnv,
  FilesEnv,
  GenerationEnv,
  ClientUiEnv,
  FeatureFlagsEnv,
  IntegrationsEnv,
  ManagedConfigEnv,
) {
  @IsOptional()
  @IsString()
  @Matches(EVENT_ID_REGEXP, {
    message: 'UI_EVENT must be a lowercase kebab-case event ID or none',
  })
  UI_EVENT?: string;

  /*
   * Operator default for the user's seasonal-celebrations switch; a choice the
   * user saved overrides it. Cosmetic and on by default, so only an explicit
   * false/0/no turns it off and a typo keeps the default.
   */
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).trim().toLowerCase());
  })
  @IsBoolean()
  UI_EVENT_ENABLED_BY_DEFAULT?: boolean = true;

  /*
   * External celebration pack policy. The default keeps every scene bundled
   * and makes no celebration request; unsetting the variables is the rollback.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === '' ? undefined : String(value).trim(),
  )
  @IsEnum(CelebrationDeliveryMode, {
    message: 'UI_EVENT_DELIVERY_MODE must be bundled or prefer-external',
  })
  UI_EVENT_DELIVERY_MODE?: CelebrationDeliveryMode =
    CelebrationDeliveryMode.Bundled;

  @IsOptional()
  @Transform(({ value }) =>
    value == null || value === '' ? undefined : String(value).trim(),
  )
  @IsString()
  @Matches(DELIVERY_REVISION_REGEXP, {
    message:
      'UI_EVENT_DELIVERY_REVISION must be 1–64 characters of letters, digits, dot, dash or underscore',
  })
  UI_EVENT_DELIVERY_REVISION?: string = '0';

  /* Comma-separated eventId/sceneId pairs; trimmed and de-duplicated. */
  @IsOptional()
  @Transform(({ value }) => parseCelebrationList(value))
  @ArrayMaxSize(CELEBRATION_POLICY_MAX_ENTRIES)
  @Matches(SCENE_PAIR_REGEXP, {
    each: true,
    message:
      'UI_EVENT_EXTERNAL_SCENES entries must be eventId/sceneId pairs of lowercase kebab-case IDs',
  })
  UI_EVENT_EXTERNAL_SCENES?: string[] = [];

  /* Comma-separated event IDs; trimmed and de-duplicated. */
  @IsOptional()
  @Transform(({ value }) => parseCelebrationList(value))
  @ArrayMaxSize(CELEBRATION_POLICY_MAX_ENTRIES)
  @Matches(EVENT_ID_REGEXP, {
    each: true,
    message:
      'UI_EVENT_EXTERNAL_EVENTS entries must be lowercase kebab-case event IDs',
  })
  @MaxLength(CELEBRATION_ID_MAX_LENGTH, { each: true })
  UI_EVENT_EXTERNAL_EVENTS?: string[] = [];
}
