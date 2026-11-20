/** Runtime features a pack scene may require; a host plays only what this release supports. */
export enum CelebrationCapability {
  /** Plays Lottie JSON with the pinned SVG-only `lottie_light` player. */
  LottieLightSvgV1 = 'lottie-light-svg-v1',
  /** Places a fixed-aspect stage in the viewport scene layer. */
  ViewportStageV1 = 'viewport-stage-v1',
  /** Anchors the stage to the measured composer by a bounded uniform scale. */
  ComposerAnchorV1 = 'composer-anchor-v1',
  /** Fits the `composer-outline` and `composer-parcel` layers to the measured composer. */
  InteractionComposerOutlineV1 = 'interaction-composer-outline-v1',
  /** Borrows reversible copies of host buttons and retargets the cat's stations onto them. */
  InteractionCatBorrowV1 = 'interaction-cat-borrow-v1',
  /** Shows a static poster image instead of motion. */
  StaticPosterV1 = 'static-poster-v1',
  /** Renders a static image button as an external event's decoration. */
  StaticTriggerV1 = 'static-trigger-v1',
}

/** How a scene adapts to right-to-left documents. */
export enum CelebrationDirectionMode {
  /** The motion is the same in both directions. */
  None = 'none',
  /** The stage is flipped horizontally around its center in RTL. */
  Mirror = 'mirror',
  /** A dedicated RTL variant is selected. */
  Variant = 'variant',
}

/** Host layout a variant targets. */
export enum CelebrationLayout {
  /** The host's mobile layout. */
  Mobile = 'mobile',
  /** The host's desktop layout. */
  Desktop = 'desktop',
}

/** Color scheme a variant targets. */
export enum CelebrationColorScheme {
  /** A light theme. */
  Light = 'light',
  /** A dark theme. */
  Dark = 'dark',
}

/** Placement templates a scene may declare. */
export enum CelebrationPlacementTemplate {
  /** A fixed-aspect stage fitted into the viewport scene layer. */
  ViewportStageV1 = 'viewport-stage-v1',
  /** A stage anchored to the measured composer. */
  ComposerAnchorV1 = 'composer-anchor-v1',
}

/** How a viewport stage scales into the viewport, always uniformly. */
export enum CelebrationStageFit {
  /** The whole stage stays visible. */
  Contain = 'contain',
  /** The stage covers the viewport and may be cropped. */
  Cover = 'cover',
}

/** Where a viewport stage sits; `start`/`end` follow the supplied direction. */
export enum CelebrationStageAlign {
  /** Centered on both axes. */
  Center = 'center',
  /** Top edge, centered horizontally. */
  Top = 'top',
  /** Bottom edge, centered horizontally. */
  Bottom = 'bottom',
  /** Top edge at the inline start. */
  TopStart = 'top-start',
  /** Top edge at the inline end. */
  TopEnd = 'top-end',
  /** Bottom edge at the inline start. */
  BottomStart = 'bottom-start',
  /** Bottom edge at the inline end. */
  BottomEnd = 'bottom-end',
}

/** Template of an external event's decoration. */
export enum CelebrationDecorationTemplate {
  /** A static image button. */
  StaticTriggerV1 = 'static-trigger-v1',
}

/** Position of the stage along one logical axis. */
export enum CelebrationStageEdge {
  /** The axis start: top, or the inline start. */
  Start = 'start',
  /** The axis center. */
  Center = 'center',
  /** The axis end: bottom, or the inline end. */
  End = 'end',
}

/** Host element a `composer-anchor-v1` stage attaches to. */
export enum CelebrationAnchor {
  /** The host composer, supplied as `anchors.composer`. */
  Composer = 'composer',
}

/** Edge of the anchor that the stage's anchor rectangle aligns with. */
export enum CelebrationAnchorEdge {
  /** The top edge. */
  Top = 'top',
  /** The bottom edge. */
  Bottom = 'bottom',
}

/** What a `composer-anchor-v1` scene does when no composer is eligible. */
export enum CelebrationAnchorFallback {
  /** Plays around a synthetic anchor in the lower half of the viewport. */
  StageAnchor = 'stage-anchor',
  /** Shows the scene poster. */
  Poster = 'poster',
}
