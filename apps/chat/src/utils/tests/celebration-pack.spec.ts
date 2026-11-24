import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
  SUPPORTED_CELEBRATION_CAPABILITIES,
} from '@epam/ai-dial-celebrations';
import type { CelebrationPlacementDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it, vi } from 'vitest';
import {
  giftWrappingScene,
  newYearPack,
} from '../../hooks/celebration/tests/celebration-pack-fixtures';
import { CelebrationPackTarget } from '../../types/celebration-pack';
import {
  mergeCelebrationLabels,
  resolveCelebrationPackLabels,
  toCelebrationPackDescriptor,
} from '../celebration-pack';

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
  it('omits only Santa on a client that does not support its scene capability', () => {
    const pack = newYearPack();
    pack.scenes.push(
      giftWrappingScene({
        id: 'santa-history-delivery',
        labelId: 'santaHistoryDeliveryToastMessage',
        requiredCapabilities: [
          'lottie-light-svg-v1',
          'viewport-stage-v1',
          'interaction-history-ladder-v1',
          'static-poster-v1',
        ],
        placement: {
          template: 'viewport-stage-v1',
          fit: 'contain',
          align: 'center',
        },
        direction: 'none',
      }),
    );
    const currentCapabilities = new Set(SUPPORTED_CELEBRATION_CAPABILITIES);
    const supports = vi
      .spyOn(SUPPORTED_CELEBRATION_CAPABILITIES, 'has')
      .mockImplementation(
        (capability) =>
          capability !== 'interaction-history-ladder-v1' &&
          currentCapabilities.has(capability),
      );
    try {
      const descriptor = toCelebrationPackDescriptor(pack, {
        ...PLAN,
        sceneIds: [
          'snowman-delivery',
          'bullfinch-couriers',
          'santa-history-delivery',
        ],
      });
      expect(descriptor?.scenes.map(({ id }) => id)).toEqual([
        'snowman-delivery',
        'bullfinch-couriers',
      ]);
      expect(descriptor?.event).toBeUndefined();
    } finally {
      supports.mockRestore();
    }
  });

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

describe('external scene labels', () => {
  const english = 'Special delivery, with a little help from friends.';
  const labels = {
    en: {
      santaHistoryDeliveryToastMessage: english,
      toastTitle: 'Happy New Year',
    },
    fr: {
      santaHistoryDeliveryToastMessage:
        'Livraison spéciale avec un peu d’aide.',
    },
    'fr-CA': {
      santaHistoryDeliveryToastMessage: 'Une livraison spéciale entre amis.',
    },
    'fr-BE': { toastTitle: 'Bonne année' },
  };

  it.each([
    ['fr-CA', labels['fr-CA'].santaHistoryDeliveryToastMessage],
    ['fr-BE', labels.fr.santaHistoryDeliveryToastMessage],
    ['ja-JP', english],
  ])(
    'resolves the Santa label for %s with locale fallback',
    (language, message) => {
      expect(resolveCelebrationPackLabels(labels, language)).toMatchObject({
        santaHistoryDeliveryToastMessage: message,
        toastTitle: language === 'fr-BE' ? 'Bonne année' : 'Happy New Year',
      });
    },
  );

  it('keeps host translations above pack labels while retaining the new Santa label', () => {
    const merged = mergeCelebrationLabels(
      { 'new-year': resolveCelebrationPackLabels(labels, 'ja-JP') },
      {
        'new-year': {
          toastTitle: 'Bonne année',
          giftLabel: 'Ouvrir le cadeau',
        },
      },
    );
    expect(merged['new-year']).toEqual({
      santaHistoryDeliveryToastMessage: english,
      toastTitle: 'Bonne année',
      giftLabel: 'Ouvrir le cadeau',
    });
  });
});
