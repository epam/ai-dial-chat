import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '@epam/ai-dial-celebrations';
import type { CelebrationPlacementDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  giftWrappingScene,
  newYearPack,
} from '../../hooks/celebration/tests/celebration-pack-fixtures';
import { CelebrationPackTarget } from '../../types/celebration-pack';
import { toCelebrationPackDescriptor } from '../celebration-pack';

const PLAN = {
  target: CelebrationPackTarget.Known,
  eventId: 'new-year',
  sceneIds: ['gift-wrapping'],
};

const describeWith = (placement: CelebrationPlacementDto) =>
  toCelebrationPackDescriptor(
    newYearPack({ scenes: [giftWrappingScene({ placement })] }),
    PLAN,
  );

describe('toCelebrationPackDescriptor', () => {
  it('maps a composer-anchor placement to the library placement', () => {
    const descriptor = toCelebrationPackDescriptor(
      newYearPack({ scenes: [giftWrappingScene()] }),
      PLAN,
    );
    expect(descriptor?.scenes[0].placement).toEqual({
      template: CelebrationPlacementTemplate.ComposerAnchorV1,
      anchor: CelebrationAnchor.Composer,
      anchorRect: { x: 340, y: 164, width: 520, height: 56 },
      edge: CelebrationAnchorEdge.Top,
      scale: { min: 0.6, max: 1 },
      fallback: CelebrationAnchorFallback.StageAnchor,
    });
  });

  it.each<[string, CelebrationPlacementDto]>([
    [
      'no anchorRect',
      { ...giftWrappingScene().placement, anchorRect: undefined },
    ],
    ['no fallback', { ...giftWrappingScene().placement, fallback: undefined }],
    ['no scale', { ...giftWrappingScene().placement, scale: undefined }],
  ])('drops a composer-anchor scene with %s', (_name, placement) => {
    expect(describeWith(placement)).toBeUndefined();
  });

  it('keeps a variant placement with the scene template', () => {
    const scene = giftWrappingScene();
    const mobile = {
      ...scene.placement,
      anchorRect: { x: 210, y: 132, width: 300, height: 56 },
      scale: { min: 0.77, max: 1 },
    };
    const descriptor = toCelebrationPackDescriptor(
      newYearPack({
        scenes: [
          {
            ...scene,
            variants: [
              scene.variants[0],
              { ...scene.variants[1], placement: mobile },
            ],
          },
        ],
      }),
      PLAN,
    );
    const [desktop, phone] = descriptor?.scenes[0].variants ?? [];
    expect(desktop).not.toHaveProperty('placement');
    expect(phone.placement).toMatchObject({
      template: CelebrationPlacementTemplate.ComposerAnchorV1,
      anchorRect: { x: 210, y: 132, width: 300, height: 56 },
      scale: { min: 0.77, max: 1 },
    });
  });

  it('drops a scene whose variant changes the placement template', () => {
    const scene = giftWrappingScene();
    expect(
      toCelebrationPackDescriptor(
        newYearPack({
          scenes: [
            {
              ...scene,
              variants: [
                {
                  ...scene.variants[0],
                  placement: {
                    template: 'viewport-stage-v1',
                    fit: 'contain',
                    align: 'bottom',
                  },
                },
              ],
            },
          ],
        }),
        PLAN,
      ),
    ).toBeUndefined();
  });

  it('drops a scene whose placement template this client does not know', () => {
    expect(describeWith({ template: 'shelf-anchor-v2' })).toBeUndefined();
  });
});
