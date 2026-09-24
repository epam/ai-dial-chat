/** Which celebration a Halloween easter-egg trigger plays. */
export enum HalloweenBurst {
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
