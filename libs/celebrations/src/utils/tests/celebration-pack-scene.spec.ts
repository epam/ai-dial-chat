import { describe, expect, it } from 'vitest';
import { SUPPORTED_CELEBRATION_CAPABILITIES } from '../../constants/celebration-capabilities';
import { packSceneFixture } from '../../test-utils/pack-fixtures';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { isCelebrationSceneSupported } from '../celebration-pack-scene';

const ANCHORED = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1 as const,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 600, y: 98, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 1, max: 1 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};

const catScene = (overrides = {}) =>
  packSceneFixture({
    requiredCapabilities: [
      CelebrationCapability.LottieLightSvgV1,
      CelebrationCapability.ComposerAnchorV1,
      CelebrationCapability.InteractionCatBorrowV1,
      CelebrationCapability.StaticPosterV1,
    ],
    placement: ANCHORED,
    direction: CelebrationDirectionMode.None,
    ...overrides,
  });

describe('isCelebrationSceneSupported', () => {
  it('reports the cat-borrow adapter as supported and other interactions as unsupported', () => {
    expect(
      SUPPORTED_CELEBRATION_CAPABILITIES.has('interaction-cat-borrow-v1'),
    ).toBe(true);
    expect(
      SUPPORTED_CELEBRATION_CAPABILITIES.has('interaction-penguin-grip-v1'),
    ).toBe(false);
  });

  it('supports a cat-borrow scene on a composer anchor with direction none', () => {
    expect(isCelebrationSceneSupported(catScene())).toBe(true);
  });

  it('rejects a cat-borrow scene on a viewport stage', () => {
    expect(
      isCelebrationSceneSupported(
        catScene({ placement: packSceneFixture().placement }),
      ),
    ).toBe(false);
  });

  it.each([CelebrationDirectionMode.Mirror, CelebrationDirectionMode.Variant])(
    'rejects a cat-borrow scene with direction %s',
    (direction) => {
      expect(isCelebrationSceneSupported(catScene({ direction }))).toBe(false);
    },
  );

  it('rejects a scene that requires both adapters', () => {
    expect(
      isCelebrationSceneSupported(
        catScene({
          requiredCapabilities: [
            ...catScene().requiredCapabilities,
            CelebrationCapability.InteractionComposerOutlineV1,
          ],
        }),
      ),
    ).toBe(false);
  });

  describe('copy-track scenes', () => {
    const copyTrackScene = (overrides = {}) =>
      catScene({
        requiredCapabilities: [
          CelebrationCapability.LottieLightSvgV1,
          CelebrationCapability.ComposerAnchorV1,
          CelebrationCapability.InteractionCopyTrackV1,
          CelebrationCapability.StaticPosterV1,
        ],
        ...overrides,
      });

    it('supports a copy-track scene on a composer anchor with direction none', () => {
      expect(
        SUPPORTED_CELEBRATION_CAPABILITIES.has('interaction-copy-track-v1'),
      ).toBe(true);
      expect(isCelebrationSceneSupported(copyTrackScene())).toBe(true);
    });

    it('rejects a copy-track scene on a viewport stage', () => {
      expect(
        isCelebrationSceneSupported(
          copyTrackScene({ placement: packSceneFixture().placement }),
        ),
      ).toBe(false);
    });

    it('rejects a copy-track scene with direction mirror', () => {
      expect(
        isCelebrationSceneSupported(
          copyTrackScene({ direction: CelebrationDirectionMode.Mirror }),
        ),
      ).toBe(false);
    });

    it('rejects a scene that requires copy-track and another adapter', () => {
      expect(
        isCelebrationSceneSupported(
          copyTrackScene({
            requiredCapabilities: [
              ...copyTrackScene().requiredCapabilities,
              CelebrationCapability.InteractionCatBorrowV1,
            ],
          }),
        ),
      ).toBe(false);
    });
  });
});
