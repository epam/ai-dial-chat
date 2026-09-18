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
 * The phrase that triggers `HalloweenBurst.Spiders` when typed into the
 * conversation input, already normalized the way
 * `isHalloweenSecretPhrase` normalizes its input.
 */
export const HALLOWEEN_SECRET_PHRASE = 'trick or treat';

/**
 * How long a burst stays mounted. Must outlast the longest animation in
 * `Halloween.module.scss` — the slowest ghost's drift — so nothing is cut off
 * mid-flight.
 */
export const HALLOWEEN_BURST_DURATION_MS = 9000;

/** Spiders dropped per `HalloweenBurst.Spiders`, each on its own thread. */
export const HALLOWEEN_SPIDER_COUNT = 9;

/** Ghosts released per `HalloweenBurst.Ghost`, each on its own flight path. */
export const HALLOWEEN_GHOST_COUNT = 7;

/**
 * How long a corner spider stays in its hiding spot after the pointer
 * startled it, before creeping back onto the web.
 */
export const HALLOWEEN_SPIDER_RETURN_MS = 2600;
