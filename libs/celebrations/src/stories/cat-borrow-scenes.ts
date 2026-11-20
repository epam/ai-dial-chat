import type {
  CelebrationComposerAnchorPlacement,
  CelebrationSceneDescriptor,
} from '../models/celebration-pack';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationLayout,
  CelebrationPlacementTemplate,
} from '../types/celebration-pack';

/** Which authored cat-borrow asset plays. */
export enum CatAsset {
  Spike = 'spike',
  Full = 'full',
}

/** Which composer and starter buttons stay borrowable. */
export enum CatButtons {
  All = 'all',
  AddOnly = 'add-only',
  None = 'none',
}

/** Height the composer's buttons are forced to, to test contact on taller controls. */
export enum SpikeButtonHeight {
  Real = 'real',
  Tall = '56',
}

/** Animation asset ids the story loaders serve for the cat-borrow fixtures. */
export const CAT_BORROW_ASSET_IDS: Readonly<Record<CatAsset, string>> = {
  [CatAsset.Spike]: 'cat-borrow-spike',
  [CatAsset.Full]: 'cat-borrow-full',
};

/** Scale of the mobile variant: the compiled mobile cat size (112 px). */
export const CAT_BORROW_MOBILE_SCALE = 0.8;

/** The draft the browser checks expect every cat-borrow outcome to keep. */
export const CAT_BORROW_DRAFT = 'Keep this draft exactly as it is';

/** The published cat-borrow placement (design D4) at a fixed `scale`. */
export const catBorrowPlacement = (
  scale: number,
): CelebrationComposerAnchorPlacement => ({
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 600, y: 98, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: scale, max: scale },
  fallback: CelebrationAnchorFallback.StageAnchor,
});

/** The placement a layout plays: scale 1 on desktop, 0.8 on the phone layout. */
export const catBorrowLayoutPlacement = (
  isMobile: boolean,
): CelebrationComposerAnchorPlacement =>
  catBorrowPlacement(isMobile ? CAT_BORROW_MOBILE_SCALE : 1);

const sceneFor = (
  asset: CatAsset,
  timing: CelebrationSceneDescriptor['timing'],
): CelebrationSceneDescriptor => ({
  id: 'cat',
  labelId: 'catToastMessage',
  renderer: CelebrationCapability.LottieLightSvgV1,
  requiredCapabilities: [
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ComposerAnchorV1,
    CelebrationCapability.InteractionCatBorrowV1,
    CelebrationCapability.StaticPosterV1,
  ],
  placement: catBorrowLayoutPlacement(false),
  direction: CelebrationDirectionMode.None,
  timing,
  posterAssetId: 'fixture-poster',
  posterDurationMs: 3000,
  variants: [
    {
      when: { layout: CelebrationLayout.Desktop },
      animationAssetId: CAT_BORROW_ASSET_IDS[asset],
    },
    {
      when: { layout: CelebrationLayout.Mobile },
      animationAssetId: CAT_BORROW_ASSET_IDS[asset],
      placement: catBorrowLayoutPlacement(true),
    },
  ],
});

/** The S4 spike descriptor: the one-prize clip on the real composer. */
export const CAT_BORROW_SPIKE_SCENE = sceneFor(CatAsset.Spike, {
  playbackDurationMs: 9500,
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  maxLifetimeMs: 12250,
});

/** The full asset: two buttons, the one-button tail and the crossing walk. */
export const CAT_BORROW_FULL_SCENE = sceneFor(CatAsset.Full, {
  playbackDurationMs: 25000,
  loadTimeoutMs: 2000,
  readyTimeoutMs: 250,
  maxLifetimeMs: 27750,
});

/* Test knobs only; they change the real components' geometry, never their DOM. */
export const catBorrowKnobStyles = (
  buttonHeight: SpikeButtonHeight,
  hasSupport: boolean,
  buttons: CatButtons,
): string =>
  [
    /* Starters below the composer are borrowable too, so one button means hiding them. */
    buttons !== CatButtons.All &&
      '.dial-ci-footer-actions { visibility: hidden !important; } .dial-starter-buttons-root { display: none !important; }',
    buttons === CatButtons.None &&
      '.dial-ci-add-cluster { visibility: hidden !important; }',
    buttonHeight === SpikeButtonHeight.Tall &&
      `.dial-ci-footer-actions button { height: ${buttonHeight}px !important; min-height: ${buttonHeight}px !important; }`,
    hasSupport &&
      '.dial-starter-buttons-list { justify-content: flex-end !important; }',
  ]
    .filter(Boolean)
    .join('\n');
