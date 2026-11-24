import type {
  HistoryLadderMode,
  HistoryLadderTrack,
} from '../types/history-ladder';
import type {
  CelebrationSnapshotSession,
  CelebrationSnapshotTarget,
} from '../utils/celebration-snapshots';
import type { SceneTargetBaseline } from '../utils/scene-targets';
import type { CelebrationAnchors } from './celebration';
import type { CelebrationTextDirection } from './celebration-pack';
import type { CornerRect } from './composer-corner';
import type { LottieComposition, Point } from './lottie-composition';
import type { LottieNamespacedMarker } from './lottie-markers';

/** Authored metadata read before host measurement or snapshot creation. */
export interface HistoryLadderMetadata {
  /** Validated native composition; callers clone it before mapping. */
  composition: LottieComposition & { fr: number };
  /** Reference station points in native CSS-pixel units. */
  references: Readonly<Record<string, Point>>;
  /** Authored visible-art envelopes owned by each station. */
  bounds: Readonly<Record<string, CornerRect>>;
  /** Optional envelope for native cards shown only in the drawn alternative. */
  drawnBounds?: CornerRect;
  /** Optional local envelope of the vehicle and its seated rider. */
  flightBounds?: CornerRect;
  /** Selects the logical start edge instead of the legacy end-edge pivot. */
  useStartEdge: boolean;
  /** Largest permitted adjacent vertical gap, in CSS pixels. */
  maxGap: number;
  /** Largest permitted adjacent horizontal drift, in CSS pixels. */
  maxDrift: number;
  /** Independent position-binding windows. */
  bindings: Record<HistoryLadderTrack, LottieNamespacedMarker[]>;
  /** Anchor of the single borrowed row. */
  copyAnchor: string;
  /** First frame at which the copy replaces its original. */
  entry: number;
  /** Frame at which the original starts to reappear. */
  restore: number;
}

/** Host inputs and authored limits of one geometry preparation. */
export interface HistoryLadderGeometryOptions {
  /** Host-owned semantic selectors. */
  anchors: CelebrationAnchors;
  /** Host writing direction; live text is never mirrored. */
  direction: CelebrationTextDirection;
  /** Six ordered reference points. */
  references: Readonly<Record<string, Point>>;
  /** Native visible-art envelopes at those references. */
  bounds: Readonly<Record<string, CornerRect>>;
  /** Additional rigid native-card envelope, checked only for the drawn route. */
  drawnBounds?: CornerRect;
  /** Selects the logical start-edge row pivot for authored support poses. */
  useStartEdge?: boolean;
  /** Checks optional viewport travel and rope corridors after station mapping. */
  isRouteSafe?: (
    points: Readonly<Record<string, Point>>,
    side: 1 | -1,
    viewport: CornerRect,
    protectedRects: readonly CornerRect[],
    mode: HistoryLadderMode,
  ) => boolean;
  /** Maximum adjacent vertical distance. */
  maxGap: number;
  /** Maximum adjacent horizontal distance. */
  maxDrift: number;
  /** Which station supplies the copy. */
  copyAnchor: string;
  /** Optional pure check of the real row's authored swept copy bounds. */
  isCopyPathSafe?: (
    copy: CelebrationSnapshotTarget,
    points: Readonly<Record<string, Point>>,
    side: 1 | -1,
    viewport: CornerRect,
    protectedRects: readonly CornerRect[],
  ) => boolean;
}

/** One fixed mapping, with the identities and baselines that invalidate it. */
export interface HistoryLadderPlan {
  /** Whether live history or native drawn cards supply the ladder. */
  mode: HistoryLadderMode;
  /** Measured station points in viewport CSS pixels. */
  points: Readonly<Record<string, Point>>;
  /** Native-art horizontal orientation. */
  side: 1 | -1;
  /** The only source row copied; absent in the drawn route. */
  copy?: CelebrationSnapshotTarget;
  /** Relevant live targets, measured before readiness. */
  watched: SceneTargetBaseline[];
  /** Detects anchor membership changes without reading layout. */
  hasTargetSetChanged: () => boolean;
  /** Layout viewport dimensions used by the private native composition. */
  width: number;
  height: number;
}

/** Lifecycle payload for one mapped history-ladder activation. */
export interface HistoryLadderPreparation {
  /** Selected native branch. */
  mode: HistoryLadderMode;
  /** Prepared inert copy, started only with the native player. */
  copy?: CelebrationSnapshotSession;
  /** Baselines and identities whose change cancels this activation. */
  watched: SceneTargetBaseline[];
  /** Detects target replacement or newly mounted protected controls. */
  hasTargetSetChanged: () => boolean;
  /** Time at which normal restoration begins, relative to native frame zero. */
  restoreMs: number;
  /** Callbacks installed after the renderer exists. */
  handlers: {
    /** Stops the scene when the copy is interrupted. */
    onCopyStopped?: () => void;
    /** Shared native/WAAPI clock origin. */
    startedAtMs?: number;
  };
}
