/** Where the client takes celebration scenes from. */
export enum CelebrationDeliveryMode {
  /** Compiled scenes only; no celebration request is made. */
  Bundled = 'bundled',
  /** Allowlisted scenes and admitted events from external packs, compiled scenes otherwise. */
  PreferExternal = 'prefer-external',
}

/*
 * The celebration ID rules, shared by environment validation
 * (`config/environment.config.ts`) and the managed value schemas
 * (`config-registry.constants.ts`), so the two can never drift. Patterns are
 * sources, not `RegExp`s, because JSON Schema needs the source text.
 */

/** The event ID that turns celebrations off. */
export const CELEBRATION_EVENT_NONE = 'none';

/** The longest event or scene ID. */
export const CELEBRATION_ID_MAX_LENGTH = 64;

/** The most entries an allowlist may hold. */
export const CELEBRATION_POLICY_MAX_ENTRIES = 64;

/* Lowercase kebab-case starting with a letter. */
const CELEBRATION_ID = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';

/** One event ID, for example `new-year`. */
export const CELEBRATION_EVENT_ID_PATTERN = `^${CELEBRATION_ID}$`;

/** An `eventId/sceneId` pair; the lookaheads cap each part at 64 characters. */
export const CELEBRATION_SCENE_PAIR_PATTERN = `^(?=[^/]{1,${CELEBRATION_ID_MAX_LENGTH}}/)${CELEBRATION_ID}/(?=[^/]{1,${CELEBRATION_ID_MAX_LENGTH}}$)${CELEBRATION_ID}$`;

/** The longest `eventId/sceneId` pair. */
export const CELEBRATION_SCENE_PAIR_MAX_LENGTH =
  CELEBRATION_ID_MAX_LENGTH * 2 + 1;

/** The delivery revision: 1–64 letters, digits, dot, dash or underscore. */
export const CELEBRATION_DELIVERY_REVISION_PATTERN = '^[A-Za-z0-9._-]{1,64}$';
