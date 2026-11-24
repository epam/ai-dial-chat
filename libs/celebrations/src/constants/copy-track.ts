import type { LottieMarkerVocabulary } from '../models/lottie-markers';
import {
  CopyTrackAnchor,
  CopyTrackContact,
  CopyTrackMarker,
  CopyTrackRole,
  CopyTrackSectionKind,
  CopyTrackStage,
} from '../types/copy-track';

/** Step-cycle slots a copy-track asset may declare. */
export const COPY_TRACK_CYCLE_SLOTS = ['0', '1', '2', '3', '4', '5', '6', '7'];

const KINDS = Object.values(CopyTrackSectionKind);

/** The `ct:` markers `interaction-copy-track-v1` reads. */
export const COPY_TRACK_MARKERS: LottieMarkerVocabulary = {
  namespace: 'ct',
  kinds: {
    [CopyTrackMarker.Section]: { arguments: KINDS, duration: false },
    [CopyTrackMarker.Trunk]: { duration: true },
    [CopyTrackMarker.Cut]: { arguments: KINDS, duration: true, maxPerScope: 4 },
    /* Kinds may share one fill; `readCopyTrackMarkers` rejects partial overlaps. */
    [CopyTrackMarker.Fill]: {
      arguments: KINDS,
      duration: true,
      maxPerScope: 4,
    },
    [CopyTrackMarker.Bind]: {
      arguments: Object.values(CopyTrackAnchor),
      duration: true,
      maxPerScope: 16,
      exclusive: true,
    },
    [CopyTrackMarker.Stretch]: {
      duration: true,
      maxPerScope: 12,
      exclusive: true,
    },
    [CopyTrackMarker.Cycle]: {
      arguments: COPY_TRACK_CYCLE_SLOTS,
      duration: true,
    },
    [CopyTrackMarker.CycleWindow]: {
      arguments: COPY_TRACK_CYCLE_SLOTS,
      duration: true,
    },
    [CopyTrackMarker.Entry]: { duration: false },
    [CopyTrackMarker.Restore]: { duration: false },
    [CopyTrackMarker.Contact]: {
      arguments: Object.values(CopyTrackContact),
      duration: false,
      maxPerScope: 8,
    },
  },
  order: [CopyTrackMarker.Entry, CopyTrackMarker.Restore],
};

/** The stage and copy role each section kind names. */
export const COPY_TRACK_SECTIONS: Readonly<
  Record<CopyTrackSectionKind, { stage: CopyTrackStage; role?: CopyTrackRole }>
> = {
  [CopyTrackSectionKind.LedgeCard]: {
    stage: CopyTrackStage.Ledge,
    role: CopyTrackRole.StarterCard,
  },
  [CopyTrackSectionKind.RimCard]: {
    stage: CopyTrackStage.Rim,
    role: CopyTrackRole.StarterCard,
  },
  [CopyTrackSectionKind.Rim]: { stage: CopyTrackStage.Rim },
  [CopyTrackSectionKind.Platform]: { stage: CopyTrackStage.Platform },
  [CopyTrackSectionKind.RimWord]: {
    stage: CopyTrackStage.Rim,
    role: CopyTrackRole.ComposerWord,
  },
};

/** Anchors placed by the span solver, which need a reference at both span ends. */
export const COPY_TRACK_STRETCHABLE_ANCHORS: readonly CopyTrackAnchor[] = [
  CopyTrackAnchor.SpanStart,
  CopyTrackAnchor.SpanEnd,
  CopyTrackAnchor.Far,
];

/** Prefix of the static nulls holding each anchor's reference position. */
export const COPY_TRACK_ANCHOR_PREFIX = 'anchor:';
/** Suffix of a stretchable anchor's minimum-span reference null. */
export const COPY_TRACK_MIN_SUFFIX = '@min';
/** Separator before the section kind in a layer that overrides a reference null or `ct-travel` for that section. */
export const COPY_TRACK_SECTION_SEPARATOR = '#';
/** Prefix of the track nulls the adapter binds. */
export const COPY_TRACK_TRACK_PREFIX = 'ct-track:';
/** Prefix of the null groups that move rigidly with the anchor named after it. */
export const COPY_TRACK_FOLLOW_PREFIX = 'ct-follow:';
/** Prefix of a layer shown only when the chosen section resolves a copy. */
export const COPY_TRACK_IF_COPY_PREFIX = 'ct-if:copy';
/** The invisible rectangle a card section's authored grips fit: the reference card. */
export const COPY_TRACK_CARD_REFERENCE = 'ct-if:copy card-ref';
/** Prefix of a layer shown only when the chosen section resolves no copy. */
export const COPY_TRACK_IF_NO_COPY_PREFIX = 'ct-if:no-copy';

/** Starter-card eligibility, from the compiled SnowmanDelivery. */
export const COPY_TRACK_STARTER_CARD = {
  /** Starter buttons inspected at most. */
  maxCandidates: 4,
  /** Narrowest card, in CSS pixels. */
  minWidth: 36,
  /** Shortest card, in CSS pixels. */
  minHeight: 24,
  /** Widest card, in CSS pixels. */
  maxWidth: 240,
  /** Tallest card, in CSS pixels. */
  maxHeight: 96,
  /** Most nodes a copied card may hold. */
  maxNodes: 40,
  /** Card width relative to the authored reference card; the grips land within its width, and with `maxWidth` the widest card matches the compiled scene's. */
  widthBand: { min: 0.75, max: 1.5 },
  /** Card height relative to the authored reference card, so the seat and the grips sit on it. */
  heightBand: { min: 0.95, max: 1.05 },
} as const;

/** Stage-template rules of `interaction-copy-track-v1`, from the compiled SnowmanDelivery; lengths in native units unless named in pixels. */
export const COPY_TRACK_STAGE_RULES = {
  /** The stance sits this far before the copy's near edge. */
  stanceToCopy: 14,
  /** Thickness of the snow cap on the composer's upper edge. */
  rimCap: 4,
  /** Lowest copy bottom above a rim floor that a hand can grip. */
  minGrip: 40,
  /** Highest copy bottom above a rim floor that a hand can grip. */
  maxReach: 128,
  /** Height the standing cast needs above its floor. */
  castHeight: 150,
  /** Head room above the seated actor, added to the copy's height. */
  seatedClearance: 130,
  /** Tallest copy a ledge stage may borrow. */
  maxLedgeCopyHeight: 66,
  /** Depth of the ground strip below a ledge or platform floor. */
  groundBelow: 14,
  /** Pixels between the lowest host content's cast and a platform floor. */
  platformGapPx: 12,
  /** Width of the platform's action area, in pixels. */
  platformActionWidthPx: { desktop: 340, mobile: 250 },
  /** Stance inset from the composer or platform edge. */
  stanceInset: 40,
  /** Pixels a band keeps from the viewport bottom and the welcome region's far edge. */
  viewportMarginPx: 16,
  /** Step of the span search, in pixels. */
  spanStepPx: 8,
  /** Pixels within which two bottoms count as one starter row. */
  rowTolerancePx: 2,
} as const;
