/**
 * Tuning values for the Halloween easter egg. Everything here is decorative:
 * nothing is persisted, sent to a backend, or reflected in a conversation.
 */

/**
 * Short `useFeatureFlag` key for the easter egg, matching the registry's
 * `features.halloweenEnabled` entry (`HALLOWEEN_ENABLED`) minus its
 * `features.` prefix.
 */
export const HALLOWEEN_FEATURE_FLAG = 'halloweenEnabled';

/**
 * The phrase that triggers `HalloweenBurst.Treats` when typed into the
 * conversation input, already normalized the way
 * `isHalloweenSecretPhrase` normalizes its input.
 */
export const HALLOWEEN_SECRET_PHRASE = 'trick or treat';

/** Pumpkin clicks that trigger `HalloweenBurst.Ghost`. */
export const HALLOWEEN_PUMPKIN_CLICKS = 5;

/**
 * How long a burst stays mounted. Must outlast the longest animation in
 * `Halloween.module.scss` so no glyph is cut off mid-fall.
 */
export const HALLOWEEN_BURST_DURATION_MS = 5000;

/** Glyphs rained by `HalloweenBurst.Treats`, cycled in order. */
export const HALLOWEEN_TREAT_GLYPHS = ['🎃', '👻', '🦇', '🍬', '🕷️'] as const;

/** Falling glyphs per `HalloweenBurst.Treats`. */
export const HALLOWEEN_TREAT_COUNT = 24;

/** Bats drifting above the empty-chat composer while the flag is on. */
export const HALLOWEEN_DECOR_BAT_COUNT = 3;
