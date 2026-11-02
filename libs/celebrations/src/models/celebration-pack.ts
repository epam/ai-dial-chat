import type {
  CelebrationColorScheme,
  CelebrationDecorationTemplate,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
  CelebrationStageAlign,
  CelebrationStageEdge,
  CelebrationStageFit,
} from '../types/celebration-pack';

/** Writing direction a host supplies to pack scenes. */
export type CelebrationTextDirection = 'ltr' | 'rtl';

/** Host inputs a pack scene adapts to; layout comes from the provider's `isMobile`. */
export interface CelebrationVariantContext {
  /** Writing direction of the host document. */
  direction: CelebrationTextDirection;
  /** Resolved color scheme of the host theme. */
  colorScheme: CelebrationColorScheme;
}

/** `viewport-stage-v1` placement of a scene. */
export interface CelebrationViewportStagePlacement {
  /** Placement template. */
  template: CelebrationPlacementTemplate.ViewportStageV1;
  /** How the stage scales into the viewport. */
  fit: CelebrationStageFit;
  /** Where the stage sits in the viewport. */
  align: CelebrationStageAlign;
}

/** Placement of a scene; this release defines only `viewport-stage-v1`. */
export type CelebrationPlacementDescriptor = CelebrationViewportStagePlacement;

/** The four deadlines of a pack scene, in milliseconds. */
export interface CelebrationSceneTiming {
  /** Authored story length, counted from renderer readiness. */
  playbackDurationMs: number;
  /** Time allowed for the player chunk plus the animation data. */
  loadTimeoutMs: number;
  /** Time from renderer creation to readiness. */
  readyTimeoutMs: number;
  /** Total scene lifetime from mount; becomes `CelebrationScene.durationMs`. */
  maxLifetimeMs: number;
}

/** Conditions a variant matches; a missing condition matches anything. */
export interface CelebrationVariantConditions {
  /** Host layout. */
  layout?: CelebrationLayout;
  /** Writing direction. */
  direction?: CelebrationTextDirection;
  /** Theme color scheme. */
  colorScheme?: CelebrationColorScheme;
}

/** One animation of a scene for a set of host conditions. */
export interface CelebrationSceneVariantDescriptor {
  /** Conditions this variant matches. */
  when: CelebrationVariantConditions;
  /** Asset id of the variant's Lottie JSON. */
  animationAssetId: string;
}

/** A pack scene, transport-independent and already validated by the host. */
export interface CelebrationSceneDescriptor {
  /** Stable scene id, unique within its event. */
  id: string;
  /** Key of the scene's notification message in the event's labels. */
  labelId: string;
  /** Renderer capability id, such as `lottie-light-svg-v1`. */
  renderer: string;
  /** Capability ids the scene needs; unknown ids make it unsupported. */
  requiredCapabilities: readonly string[];
  /** Where the stage renders. */
  placement: CelebrationPlacementDescriptor;
  /** How the scene adapts to RTL. */
  direction: CelebrationDirectionMode;
  /** Deadlines of the scene. */
  timing: CelebrationSceneTiming;
  /** Asset id of the static poster. */
  posterAssetId: string;
  /** How long the poster shows, in milliseconds. */
  posterDurationMs: number;
  /** Animations for different host conditions, in declaration order. */
  variants: readonly CelebrationSceneVariantDescriptor[];
}

/** Decoration of an external-only event. */
export interface CelebrationDecorationDescriptor {
  /** Decoration template. */
  template: CelebrationDecorationTemplate;
  /** Asset id of the trigger image. */
  posterAssetId: string;
  /** Key of the trigger's accessible name in the event's labels. */
  labelId: string;
}

/** Event-level fields that only an external-only pack declares. */
export interface CelebrationExternalEventDescriptor {
  /** Key of the notification title in the event's labels. */
  titleLabelId: string;
  /** Scenes a trigger click chooses from. */
  clickSceneIds: readonly string[];
  /** Asset id of the icon a host may show instead of its logo. */
  iconAssetId?: string;
  /** The event's start-page decoration. */
  decoration: CelebrationDecorationDescriptor;
}

/** One validated pack version for one event. */
export interface CelebrationPackDescriptor {
  /** Stable pack id. */
  packId: string;
  /** Pack version. */
  version: string;
  /** Event the pack belongs to. */
  eventId: string;
  /** Scenes of the pack. */
  scenes: readonly CelebrationSceneDescriptor[];
  /** English default labels keyed by label id. */
  labels?: Readonly<Record<string, string>>;
  /** Present only for an external-only event. */
  event?: CelebrationExternalEventDescriptor;
}

/** Host callbacks through which pack scenes reach their assets. */
export interface CelebrationAssetLoaders {
  /** Resolves parsed, host-validated Lottie JSON; must reject on abort. */
  loadAnimationData: (assetId: string, signal: AbortSignal) => Promise<unknown>;
  /** Returns a host-built image URL for `<img>`; `undefined` when unavailable. */
  resolveImageUrl: (assetId: string) => string | undefined;
}

/** Inputs of variant selection: the variant context plus the host layout. */
export interface CelebrationVariantInput extends CelebrationVariantContext {
  /** Host layout. */
  layout: CelebrationLayout;
}

/** Logical position of a viewport stage. */
export interface CelebrationStageAlignment {
  /** Position along the block (vertical) axis. */
  block: CelebrationStageEdge;
  /** Position along the inline axis, resolved against the stage's `dir`. */
  inline: CelebrationStageEdge;
}
