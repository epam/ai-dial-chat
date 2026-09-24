import { HalloweenBurst } from '../types/halloween';

/**
 * Tuning values for the Halloween easter egg. Everything here is decorative:
 * nothing is persisted, sent to a backend, or reflected in a conversation.
 */

/**
 * The phrase that triggers `HalloweenBurst.Spiders` when typed into the
 * conversation input, already normalized the way
 * `isHalloweenSecretPhrase` normalizes its input.
 */
export const HALLOWEEN_SECRET_PHRASE = 'trick or treat';

/**
 * How long a burst stays mounted. Must outlast the longest animation in
 * `Halloween.module.scss` including web weaving and departure so nothing is cut off
 * mid-flight.
 */
export const HALLOWEEN_BURST_DURATION_MS = 14000;

/** Spiders dropped per `HalloweenBurst.Spiders`, each on its own thread. */
export const HALLOWEEN_SPIDER_COUNT = 9;

/** Ghosts released per `HalloweenBurst.Ghost`, each on its own flight path. */
export const HALLOWEEN_GHOST_COUNT = 7;

/**
 * How close, in pixels, the pointer gets to a corner spider before it bolts.
 * Generous enough that the spider moves before the cursor is on top of it,
 * which is what makes it feel skittish rather than clicked.
 */
export const HALLOWEEN_SPIDER_FLEE_RADIUS_PX = 120;

/** How far, in pixels, a corner spider bolts per nudge. */
export const HALLOWEEN_SPIDER_FLEE_STEP_PX = 64;

/**
 * How far, in pixels, a corner spider may stray from its perch. Cornered at
 * this radius it slides around the boundary instead of stopping dead, so a
 * pointer can herd it around the web but never pin it.
 */
export const HALLOWEEN_SPIDER_MAX_OFFSET_PX = 104;

/**
 * How long a corner spider waits, undisturbed, before creeping back to its
 * perch.
 */
export const HALLOWEEN_SPIDER_RETURN_MS = 2600;

/** Pumpkin surprises, sampled randomly without consecutive repeats. */
export const HALLOWEEN_CLICK_BURSTS = [
  HalloweenBurst.Ghost,
  HalloweenBurst.Web,
  HalloweenBurst.Bats,
  HalloweenBurst.Cat,
  HalloweenBurst.Witches,
] as const;

export const HALLOWEEN_WEB_COUNT = 80;
export const HALLOWEEN_MOBILE_WEB_COUNT = 54;
export const HALLOWEEN_BAT_COUNT = 16;
export const HALLOWEEN_WISP_COUNT = 18;

export const HALLOWEEN_WITCH_COUNT = 5;
