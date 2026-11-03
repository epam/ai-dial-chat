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
import { CelebrationDeliveryMode } from '../../app-config/types/celebration-delivery';

const CELEBRATION_ID_MAX_LENGTH = 64;
const CELEBRATION_POLICY_MAX_ENTRIES = 64;
const CELEBRATION_ID = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const CELEBRATION_EVENT_ID_PATTERN = new RegExp(`^${CELEBRATION_ID}$`);
/* The lookaheads cap each part at 64 characters. */
const CELEBRATION_SCENE_PAIR_PATTERN = new RegExp(
  `^(?=[^/]{1,${CELEBRATION_ID_MAX_LENGTH}}/)${CELEBRATION_ID}/(?=[^/]{1,${CELEBRATION_ID_MAX_LENGTH}}$)${CELEBRATION_ID}$`,
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

/** Celebration (`UI_EVENT*`) policy and external pack selection. */
export class CelebrationsEnv {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, {
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
  @Matches(/^[A-Za-z0-9._-]{1,64}$/, {
    message:
      'UI_EVENT_DELIVERY_REVISION must be 1–64 characters of letters, digits, dot, dash or underscore',
  })
  UI_EVENT_DELIVERY_REVISION?: string = '0';

  /* Comma-separated eventId/sceneId pairs; trimmed and de-duplicated. */
  @IsOptional()
  @Transform(({ value }) => parseCelebrationList(value))
  @ArrayMaxSize(CELEBRATION_POLICY_MAX_ENTRIES)
  @Matches(CELEBRATION_SCENE_PAIR_PATTERN, {
    each: true,
    message:
      'UI_EVENT_EXTERNAL_SCENES entries must be eventId/sceneId pairs of lowercase kebab-case IDs',
  })
  UI_EVENT_EXTERNAL_SCENES?: string[] = [];

  /* Comma-separated event IDs; trimmed and de-duplicated. */
  @IsOptional()
  @Transform(({ value }) => parseCelebrationList(value))
  @ArrayMaxSize(CELEBRATION_POLICY_MAX_ENTRIES)
  @Matches(CELEBRATION_EVENT_ID_PATTERN, {
    each: true,
    message:
      'UI_EVENT_EXTERNAL_EVENTS entries must be lowercase kebab-case event IDs',
  })
  @MaxLength(CELEBRATION_ID_MAX_LENGTH, { each: true })
  UI_EVENT_EXTERNAL_EVENTS?: string[] = [];
}
