import {
  CelebrationColorScheme,
  type CelebrationEvent,
  type CelebrationEventLoader,
  type CelebrationScene,
} from '@epam/ai-dial-celebrations';
import { createCelebrationSceneFromDescriptor } from '@epam/ai-dial-celebrations/packs';
import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationPacksOptions } from '../../../models/celebration-pack';
import {
  getCelebrationCatalog,
  getCelebrationPack,
  loadCelebrationAssetJson,
} from '../../../server-api/celebrations.api';
import { BUNDLED_PACK_KEY, useCelebrationPacks } from '../useCelebrationPacks';
import {
  ANIMATION_DATA,
  ANNIVERSARY_ICON_ID,
  BUNDLED_DELIVERY,
  CATALOG,
  COURIERS_DELIVERY,
  PILOT_DELIVERY,
  SNOWMAN_DESKTOP_ID,
  SNOWMAN_POSTER_ID,
  anniversaryPack,
  newYearPack,
} from './celebration-pack-fixtures';

vi.mock('@epam/ai-dial-celebrations/packs', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-celebrations/packs')>();
  return {
    ...actual,
    createCelebrationSceneFromDescriptor: vi.fn(
      actual.createCelebrationSceneFromDescriptor,
    ),
  };
});
vi.mock('../../../server-api/celebrations.api', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../server-api/celebrations.api')
  >()),
  getCelebrationCatalog: vi.fn(),
  getCelebrationPack: vi.fn(),
  loadCelebrationAssetJson: vi.fn(),
}));

const BundledScene = () => null;
const bundledScene = (id: string, labelId: string): CelebrationScene => ({
  id,
  labelId,
  durationMs: 20000,
  Component: BundledScene,
});

const NEW_YEAR: CelebrationEvent = {
  id: 'new-year',
  Decoration: () => null,
  scenes: [
    bundledScene('penguin-star', 'penguinStarToastMessage'),
    bundledScene('gift-wrapping', 'giftWrappingToastMessage'),
    bundledScene('snowman-delivery', 'snowmanDeliveryToastMessage'),
  ],
  clickSceneIds: ['penguin-star', 'snowman-delivery'],
  labels: { toastTitle: 'Happy New Year' },
  titleLabelId: 'toastTitle',
  secretTrigger: {
    phrases: ['happy new year'],
    hintPhrase: 'happy new year',
    sceneIds: ['gift-wrapping'],
  },
};

const COMPILED: Readonly<Record<string, CelebrationEventLoader>> = {
  halloween: async () => ({ ...NEW_YEAR, id: 'halloween' }),
  'new-year': async () => ({ default: NEW_YEAR }),
};

const options = (
  overrides: Partial<CelebrationPacksOptions> = {},
): CelebrationPacksOptions => ({
  compiledEvents: COMPILED,
  activeEventId: 'new-year',
  delivery: PILOT_DELIVERY,
  colorScheme: CelebrationColorScheme.Light,
  direction: 'ltr',
  language: 'en',
  ...overrides,
});

const renderPacks = (overrides: Partial<CelebrationPacksOptions> = {}) =>
  renderHook((props: CelebrationPacksOptions) => useCelebrationPacks(props), {
    initialProps: options(overrides),
  });

const loadActive = async (
  events: Readonly<Record<string, CelebrationEventLoader>>,
  eventId: string,
): Promise<CelebrationEvent> => {
  const loaded = await events[eventId]();
  return 'default' in loaded ? loaded.default : loaded;
};

/* Lets pending effects and microtasks settle before asserting on silence. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('useCelebrationPacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCelebrationCatalog).mockResolvedValue(CATALOG);
    vi.mocked(getCelebrationPack).mockImplementation(async (packId) =>
      packId === 'company-anniversary' ? anniversaryPack() : newYearPack(),
    );
    vi.mocked(loadCelebrationAssetJson).mockResolvedValue(ANIMATION_DATA);
  });

  describe('requests nothing', () => {
    it.each([
      ['the bundled policy', { delivery: BUNDLED_DELIVERY }],
      ['UI_EVENT=none', { activeEventId: null }],
      [
        'a compiled event with no allowlisted scene',
        { activeEventId: 'halloween' },
      ],
      [
        'an external-only event that is not admitted',
        { activeEventId: 'product-launch' },
      ],
    ])('for %s', async (_name, overrides) => {
      const { result } = renderPacks(overrides);
      await settle();

      expect(getCelebrationCatalog).not.toHaveBeenCalled();
      expect(getCelebrationPack).not.toHaveBeenCalled();
      expect(result.current.events).toBe(COMPILED);
      expect(result.current.packKey).toBe(BUNDLED_PACK_KEY);
      expect(result.current.catalogRevision).toBeNull();
    });

    it('registers no loader for an external-only event that is not admitted', async () => {
      const { result } = renderPacks({ activeEventId: 'product-launch' });
      await settle();

      expect(result.current.events['product-launch']).toBeUndefined();
    });
  });

  describe('keeps the bundled event', () => {
    it('when the catalog request fails with 503', async () => {
      vi.mocked(getCelebrationCatalog).mockRejectedValue(
        new ResponseError(new Response(null, { status: 503 })),
      );
      const { result } = renderPacks();
      await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalled());
      await settle();

      expect(result.current.events).toBe(COMPILED);
      expect(result.current.packKey).toBe(BUNDLED_PACK_KEY);
    });

    it('when the index names no pack for the event', async () => {
      vi.mocked(getCelebrationCatalog).mockResolvedValue({
        ...CATALOG,
        defaults: {},
      });
      const { result } = renderPacks();
      await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalled());
      await settle();

      expect(getCelebrationPack).not.toHaveBeenCalled();
      expect(result.current.events).toBe(COMPILED);
    });

    it('when the allowlisted scene requires a capability this client lacks', async () => {
      const pack = newYearPack();
      vi.mocked(getCelebrationPack).mockResolvedValue({
        ...pack,
        scenes: pack.scenes.map((scene) => ({
          ...scene,
          requiredCapabilities: ['composer-anchor-v1'],
          placement: { template: 'composer-anchor-v1' },
        })),
      });
      const { result } = renderPacks();
      await waitFor(() => expect(getCelebrationPack).toHaveBeenCalled());
      await settle();

      expect(result.current.events).toBe(COMPILED);
      expect(result.current.packKey).toBe(BUNDLED_PACK_KEY);
    });

    it('when a known-event pack carries an event block', async () => {
      vi.mocked(getCelebrationPack).mockResolvedValue(
        newYearPack({ event: anniversaryPack().event }),
      );
      const { result } = renderPacks();
      await waitFor(() => expect(getCelebrationPack).toHaveBeenCalled());
      await settle();

      expect(result.current.events).toBe(COMPILED);
    });
  });

  it('replaces the allowlisted snowman, adds the allowlisted couriers and ignores the unlisted sleigh', async () => {
    const { result } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).toBe(
        'new-year-default@1.0.0:snowman-delivery,bullfinch-couriers',
      ),
    );

    expect(getCelebrationPack).toHaveBeenCalledWith(
      'new-year-default',
      '1.0.0',
      expect.any(AbortSignal),
    );
    expect(result.current.catalogRevision).toBe(CATALOG.revision);
    expect(result.current.events.halloween).toBe(COMPILED.halloween);
    const event = await loadActive(result.current.events, 'new-year');
    expect(event.scenes.map(({ id }) => id)).toEqual([
      'penguin-star',
      'gift-wrapping',
      'snowman-delivery',
      'bullfinch-couriers',
    ]);
    expect(event.scenes[0]).toBe(NEW_YEAR.scenes[0]);
    expect(event.scenes[1]).toBe(NEW_YEAR.scenes[1]);
    expect(event.scenes[2]).toMatchObject({
      labelId: 'snowmanDeliveryToastMessage',
      durationMs: 15000,
    });
    expect(event.scenes[2].Component).not.toBe(BundledScene);
    expect(event.scenes[3]).toMatchObject({
      labelId: 'bullfinchCouriersToastMessage',
    });
    expect(event.clickSceneIds).toEqual([
      ...NEW_YEAR.clickSceneIds,
      'bullfinch-couriers',
    ]);
    expect(event.secretTrigger).toEqual(NEW_YEAR.secretTrigger);
    expect(event.labels).toMatchObject({
      toastTitle: 'Happy New Year',
      bullfinchCouriersToastMessage: 'Two couriers, one gingerbread star.',
    });
  });

  it('keeps the bundled snowman when only the couriers are allowlisted', async () => {
    const { result } = renderPacks({ delivery: COURIERS_DELIVERY });
    await waitFor(() =>
      expect(result.current.packKey).toBe(
        'new-year-default@1.0.0:bullfinch-couriers',
      ),
    );

    const event = await loadActive(result.current.events, 'new-year');
    expect(event.scenes.slice(0, 3)).toEqual(NEW_YEAR.scenes);
    expect(event.clickSceneIds).toEqual([
      ...NEW_YEAR.clickSceneIds,
      'bullfinch-couriers',
    ]);
  });

  it('resolves an admitted external-only event through the descriptor factory', async () => {
    const { result } = renderPacks({ activeEventId: 'company-anniversary' });
    await waitFor(() =>
      expect(result.current.packKey).toBe('company-anniversary@1.0.0'),
    );

    const event = await loadActive(
      result.current.events,
      'company-anniversary',
    );
    expect(event).toMatchObject({
      id: 'company-anniversary',
      clickSceneIds: ['confetti'],
      titleLabelId: 'toastTitle',
      iconUrl: `/api/v1/celebrations/assets/${ANNIVERSARY_ICON_ID}`,
      labels: expect.objectContaining({ toastTitle: 'Happy anniversary' }),
    });
    expect(event.secretTrigger).toBeUndefined();
    expect(result.current.labels['company-anniversary']).toMatchObject({
      triggerLabel: 'Celebrate the anniversary',
    });
  });

  it('hides an external-only event whose click scene is unsupported', async () => {
    const pack = anniversaryPack();
    vi.mocked(getCelebrationPack).mockResolvedValue({
      ...pack,
      scenes: pack.scenes.map((scene) => ({
        ...scene,
        renderer: 'dotlottie-v1',
      })),
    });
    const { result } = renderPacks({ activeEventId: 'company-anniversary' });
    await waitFor(() => expect(getCelebrationPack).toHaveBeenCalled());
    await settle();

    expect(result.current.events['company-anniversary']).toBeUndefined();
  });

  it('serves declared assets only, and parses each animation once per page', async () => {
    const { result } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).not.toBe(BUNDLED_PACK_KEY),
    );
    await loadActive(result.current.events, 'new-year');
    const [descriptor, loaders, context] = vi.mocked(
      createCelebrationSceneFromDescriptor,
    ).mock.calls[0];
    const signal = new AbortController().signal;

    expect(descriptor.id).toBe('snowman-delivery');
    expect(context).toEqual({
      direction: 'ltr',
      colorScheme: CelebrationColorScheme.Light,
    });
    expect(await loaders.loadAnimationData(SNOWMAN_DESKTOP_ID, signal)).toBe(
      ANIMATION_DATA,
    );
    await loaders.loadAnimationData(SNOWMAN_DESKTOP_ID, signal);
    expect(loadCelebrationAssetJson).toHaveBeenCalledOnce();
    expect(loadCelebrationAssetJson).toHaveBeenCalledWith(
      SNOWMAN_DESKTOP_ID,
      signal,
    );
    await expect(
      loaders.loadAnimationData(SNOWMAN_POSTER_ID, signal),
    ).rejects.toThrow(TypeError);
    expect(loaders.resolveImageUrl(SNOWMAN_POSTER_ID)).toBe(
      `/api/v1/celebrations/assets/${SNOWMAN_POSTER_ID}`,
    );
    expect(loaders.resolveImageUrl(SNOWMAN_DESKTOP_ID)).toBeUndefined();
    expect(loaders.resolveImageUrl('unknown.0000000000000000')).toBeUndefined();
  });

  it('aborts the pending request on unmount', async () => {
    vi.mocked(getCelebrationCatalog).mockReturnValue(
      new Promise(() => undefined),
    );
    const { unmount } = renderPacks();
    await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalled());
    const signal = vi.mocked(getCelebrationCatalog).mock.calls[0][0];

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('aborts the pending request and ignores its result when the event changes', async () => {
    let resolveFirst: (value: typeof CATALOG) => void = () => undefined;
    vi.mocked(getCelebrationCatalog)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValue(CATALOG);
    const { result, rerender } = renderPacks();
    await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalled());
    const firstSignal = vi.mocked(getCelebrationCatalog).mock.calls[0][0];

    rerender(options({ activeEventId: 'company-anniversary' }));
    resolveFirst(CATALOG);
    await waitFor(() =>
      expect(result.current.packKey).toBe('company-anniversary@1.0.0'),
    );

    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.events['new-year']).toBe(COMPILED['new-year']);
  });

  it('keeps every identity across a re-render with an equal policy object', async () => {
    const { result, rerender } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).not.toBe(BUNDLED_PACK_KEY),
    );
    const first = result.current;

    rerender(
      options({
        delivery: {
          ...PILOT_DELIVERY,
          externalScenes: [...PILOT_DELIVERY.externalScenes].reverse(),
        },
      }),
    );

    expect(result.current.events).toBe(first.events);
    expect(result.current.labels).toBe(first.labels);
    expect(getCelebrationCatalog).toHaveBeenCalledOnce();
  });

  it('fetches a pack version once per page when the event comes back', async () => {
    const { result, rerender } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).not.toBe(BUNDLED_PACK_KEY),
    );

    rerender(options({ activeEventId: null }));
    rerender(options());
    await waitFor(() => expect(getCelebrationCatalog).toHaveBeenCalledTimes(2));
    await settle();

    expect(getCelebrationPack).toHaveBeenCalledOnce();
  });

  it('falls back to bundled when a revisited event lost its index default', async () => {
    const { result, rerender } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).not.toBe(BUNDLED_PACK_KEY),
    );
    vi.mocked(getCelebrationCatalog).mockResolvedValue({
      ...CATALOG,
      defaults: {},
    });

    rerender(options({ activeEventId: null }));
    rerender(options());

    await waitFor(() => expect(result.current.packKey).toBe(BUNDLED_PACK_KEY));
    expect(result.current.events).toBe(COMPILED);
  });

  it.each([
    ['de-AT', 'Jubiläum feiern'],
    ['de', 'Jubiläum feiern'],
    ['fr', 'Celebrate the anniversary'],
  ])(
    'localizes pack labels for %s with base-language and English fallback',
    async (language, triggerLabel) => {
      const { result } = renderPacks({
        activeEventId: 'company-anniversary',
        language,
      });
      await waitFor(() =>
        expect(result.current.labels['company-anniversary']).toBeDefined(),
      );

      expect(result.current.labels['company-anniversary']).toEqual({
        toastTitle: 'Happy anniversary',
        triggerLabel,
        confettiToastMessage: 'Confetti for everyone',
      });
    },
  );

  it('recomposes for a new direction without refetching', async () => {
    const { result, rerender } = renderPacks();
    await waitFor(() =>
      expect(result.current.packKey).not.toBe(BUNDLED_PACK_KEY),
    );
    const first = result.current.events;

    rerender(options({ direction: 'rtl' }));
    await loadActive(result.current.events, 'new-year');

    expect(result.current.events).not.toBe(first);
    expect(getCelebrationCatalog).toHaveBeenCalledOnce();
    expect(
      vi.mocked(createCelebrationSceneFromDescriptor).mock.calls.at(-1)?.[2],
    ).toMatchObject({ direction: 'rtl' });
  });
});
