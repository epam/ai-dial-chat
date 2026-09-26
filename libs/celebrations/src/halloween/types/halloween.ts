/** Every Halloween scene; hosts enable or disable them by these ids. */
export enum HalloweenScene {
  /**
   * Spiders abseil from the top edge, sway on their threads, and climb back
   * up. Triggered by the secret phrase — the trick half of the bargain.
   */
  Spiders = 'spiders',
  /** A flock of ghosts drifts across the viewport. Triggered by the pumpkin. */
  Ghost = 'ghost',
  /** Spiders weave silk across the start screen, including the history panel. */
  Web = 'web',
  /** Small bats sweep past with individually flapping wings. */
  Bats = 'bats',
  /** A black cat follows drifting will-o’-the-wisps. */
  Cat = 'cat',
  /** Witches fly across the sky on broomsticks. */
  Witches = 'witches',
  Train = 'train',
  Portal = 'portal',
  Ravens = 'ravens',
  Candy = 'candy',
  Footprints = 'footprints',
  Skeletons = 'skeletons',
  Cauldron = 'cauldron',
  Mimic = 'mimic',
  Bowling = 'bowling',
  Mummy = 'mummy',
}

/**
 * The ghost silhouettes `HalloweenGhost` can draw. A flock mixes them so no
 * two neighbours look alike.
 */
export enum HalloweenGhostVariant {
  /** Rounded head over three wide humps — the storybook ghost. */
  Classic = 'classic',
  /** Narrow and tall, with four small humps and sleepy half-shut eyes. */
  Tall = 'tall',
  /** Squat and wide, with two humps and a surprised open mouth. */
  Blob = 'blob',
  /** Small and round, winking. */
  Sprite = 'sprite',
}

/** What the corner spider is up to; drives its CSS pose and fidgets. */
export enum HalloweenSpiderMood {
  /** Fidgeting on its perch or dangling on an idle drop. */
  Idle = 'idle',
  /** The pointer is close: fidgets freeze and it watches. */
  Alert = 'alert',
  /** Spinning silk around the pumpkin. */
  Wrapping = 'wrapping',
  /** The pumpkin shook it off; eyes wide, climbing away. */
  Startled = 'startled',
}

/** Corner-spider behaviors of the Halloween decoration that hosts can switch off. */
export enum HalloweenDecorBehavior {
  /** Bolts away from a nearby pointer and creeps back to its perch. */
  SpiderFlee = 'spider-flee',
  /** Now and then lowers itself on a thread and climbs back. */
  SpiderDrop = 'spider-drop',
  /** Drums its legs while the user types in a text field. */
  SpiderDrum = 'spider-drum',
  /** After a quiet spell climbs down and wraps the pumpkin in silk. */
  PumpkinWrap = 'pumpkin-wrap',
}
