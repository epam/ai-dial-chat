import type { CelebrationAnchors } from '../models/celebration';
import type {
  CelebrationComposerAnchorPlacement,
  CelebrationSceneDescriptor,
} from '../models/celebration-pack';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import { CelebrationPlacementTemplate } from '../types/celebration-pack';
import {
  onCatBorrowAnimationCreated,
  onCatBorrowPlaybackStarted,
  prepareCatBorrowScene,
} from './cat-borrow-adapter';
import {
  prepareAnchoredSceneData,
  requiresCatBorrow,
  requiresComposerOutline,
  type PackScenePreparation,
} from './celebration-pack-scene';
import { watchComposer } from './composer-watch';

/** Host inputs an anchored adapter prepares against, fixed at activation. */
export interface PackSceneAdapterEnvironment {
  /** Host anchor class names. */
  anchors: CelebrationAnchors;
  /** Whether a `mirror` scene is flipped for RTL. */
  isMirrored: boolean;
}

/** How `LottieScene` runs one kind of `composer-anchor-v1` scene. */
export interface PackSceneAdapter {
  /** Anchors whose change ends the scene. */
  watchedAnchors: readonly (keyof CelebrationAnchors)[];
  /** Whether this browser has the APIs the adapter needs. */
  isAvailable: () => boolean;
  /** Measures the host and returns a private, mapped copy of the data; throws to show the poster. */
  prepare: (
    data: unknown,
    placement: CelebrationComposerAnchorPlacement,
    environment: PackSceneAdapterEnvironment,
  ) => PackScenePreparation;
  /** Installs observers once the renderer exists. */
  onAnimationCreated: (
    context: LottieAnimationContext<PackScenePreparation>,
  ) => void;
  /** Starts companions on the Lottie clock. */
  onPlaybackStarted?: (
    context: LottiePlaybackStartContext<PackScenePreparation>,
  ) => void;
}

const hasObservers = () =>
  typeof ResizeObserver === 'function' &&
  typeof MutationObserver === 'function';

const hasWebAnimations = () =>
  typeof Element !== 'undefined' &&
  typeof Element.prototype.animate === 'function';

const watchAnchor = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>) =>
  watchComposer({
    source: preparation.anchor?.source ?? null,
    host,
    addDisposer,
    cancel,
  });

const anchoredAdapter = (withOutline: boolean): PackSceneAdapter => ({
  watchedAnchors: ['composer'],
  isAvailable: hasObservers,
  prepare: (data, placement, { anchors, isMirrored }) =>
    prepareAnchoredSceneData(
      data,
      placement,
      anchors.composer,
      isMirrored,
      withOutline,
    ),
  onAnimationCreated: watchAnchor,
});

const CAT_BORROW_ADAPTER: PackSceneAdapter = {
  /* The cat also measures the starters below the composer. */
  watchedAnchors: ['composer', 'starterList', 'welcomeRegion'],
  isAvailable: () => hasObservers() && hasWebAnimations(),
  prepare: (data, placement, { anchors }) =>
    prepareCatBorrowScene(data, placement, anchors),
  onAnimationCreated: (context) => {
    watchAnchor(context);
    onCatBorrowAnimationCreated(context);
  },
  onPlaybackStarted: onCatBorrowPlaybackStarted,
};

/** Returns the adapter of a `composer-anchor-v1` scene, or `undefined` for a viewport stage. */
export const resolvePackSceneAdapter = (
  scene: CelebrationSceneDescriptor,
): PackSceneAdapter | undefined => {
  if (
    scene.placement.template !== CelebrationPlacementTemplate.ComposerAnchorV1
  )
    return undefined;
  return requiresCatBorrow(scene)
    ? CAT_BORROW_ADAPTER
    : anchoredAdapter(requiresComposerOutline(scene));
};
