import { HalloweenBurst } from '../types/halloween';

/**
 * Tuning values for the Halloween easter egg. Everything here is decorative:
 * nothing is persisted, sent to a backend, or reflected in a conversation.
 */

/** The phrase that triggers a secret scene when typed into the conversation input. */
export const HALLOWEEN_SECRET_PHRASE = 'trick or treat';

/**
 * How long a burst stays mounted. Must outlast the longest animation in
 * `Halloween.module.scss` including web weaving and departure so nothing is cut off
 * mid-flight.
 */
export const HALLOWEEN_BURST_DURATION_MS = 14000;

/** Room for the crosswind scene's pauses, deceleration and lazy departure. */
export const HALLOWEEN_BAT_SCENE_DURATION_MS = 17500;

/** Time for an unhurried walk, a long sit, paced pushes, falling prizes and grooming. */
export const HALLOWEEN_CAT_SCENE_DURATION_MS = 25000;

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

/** Undisturbed pause, in ms, before the corner spider pays out its thread. */
export const HALLOWEEN_SPIDER_DROP_DELAY_MS = [10000, 20000] as const;

/** One idle drop — descend, dangle and climb back — in ms. */
export const HALLOWEEN_SPIDER_DROP_MS = 5200;

/** How far, in pixels, the corner spider lowers itself on its thread. */
export const HALLOWEEN_SPIDER_DROP_DEPTH_PX = [60, 120] as const;

/** How fast, in ms, the spider reels in when the pointer interrupts a drop. */
export const HALLOWEEN_SPIDER_RETRACT_MS = 220;

/**
 * Within this distance, in pixels, the corner spider stops fidgeting, reels
 * in and freezes to watch the pointer; closer still, it bolts.
 */
export const HALLOWEEN_SPIDER_ALERT_RADIUS_PX = 240;

/** How far, in degrees, the spider leans to keep the pointer in view. */
export const HALLOWEEN_SPIDER_WATCH_MAX_DEG = 28;

/** Optional audio asset URL for the train scene; silent by default. */
export const HALLOWEEN_TRAIN_AUDIO_SRC: string | undefined = undefined;

/** Pumpkin surprises, sampled randomly without consecutive repeats. */
export const HALLOWEEN_CLICK_BURSTS = [
  HalloweenBurst.Ghost,
  HalloweenBurst.Web,
  HalloweenBurst.Bats,
  HalloweenBurst.Cat,
  HalloweenBurst.Witches,
  HalloweenBurst.Train,
  HalloweenBurst.Portal,
  HalloweenBurst.Ravens,
  HalloweenBurst.Candy,
  HalloweenBurst.Footprints,
  HalloweenBurst.Skeletons,
] as const;

/** Message-only surprises; pumpkin clicks never sample this pool. */
export const HALLOWEEN_SECRET_BURSTS = [
  HalloweenBurst.Spiders,
  HalloweenBurst.Cauldron,
  HalloweenBurst.Mimic,
  HalloweenBurst.Bowling,
  HalloweenBurst.Mummy,
] as const;

/** Deadlines include the borrowed rows returning and all delayed exits. */
export const HALLOWEEN_SCENE_DURATIONS: Partial<
  Record<HalloweenBurst, number>
> = {
  [HalloweenBurst.Bats]: HALLOWEEN_BAT_SCENE_DURATION_MS + 500,
  [HalloweenBurst.Cat]: HALLOWEEN_CAT_SCENE_DURATION_MS + 500,
  [HalloweenBurst.Train]: 12000,
  [HalloweenBurst.Portal]: 10000,
  [HalloweenBurst.Ravens]: 13000,
  [HalloweenBurst.Candy]: 11000,
  [HalloweenBurst.Footprints]: 12000,
  [HalloweenBurst.Skeletons]: 10000,
  [HalloweenBurst.Cauldron]: 9000,
  [HalloweenBurst.Mimic]: 9000,
  [HalloweenBurst.Bowling]: 9000,
  [HalloweenBurst.Mummy]: 13000,
};

export const HALLOWEEN_WEB_COUNT = 80;
export const HALLOWEEN_MOBILE_WEB_COUNT = 54;
export const HALLOWEEN_BAT_COUNT = 16;
export const HALLOWEEN_WISP_COUNT = 18;

export const HALLOWEEN_WITCH_COUNT = 5;

/**
 * How long, in ms, the user must leave the page alone before the corner
 * spider climbs down and wraps the pumpkin in silk.
 */
export const HALLOWEEN_SPIDER_WRAP_IDLE_MS = 60000;

/** How long, in ms, a keystroke keeps the spider drumming its legs. */
export const HALLOWEEN_SPIDER_DRUM_MS = 700;
