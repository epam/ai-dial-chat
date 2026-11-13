import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CelebrationDecor } from '../../components/CelebrationDecor/CelebrationDecor';
import { CelebrationProvider } from '../../context/CelebrationContext';
import type { CelebrationAssetLoaders } from '../../models/celebration-pack';
import { newYearEvent } from '../../new-year';
import { NewYearScene } from '../../new-year/types/new-year';
import {
  externalPackFixture,
  packSceneFixture,
} from '../../test-utils/pack-fixtures';
import { CelebrationColorScheme } from '../../types/celebration-pack';
import {
  addCelebrationScenes,
  createCelebrationEventFromDescriptor,
  createCelebrationSceneFromDescriptor,
  replaceCelebrationScenes,
} from '../celebration-descriptor-event';

const CONTEXT = {
  direction: 'ltr' as const,
  colorScheme: CelebrationColorScheme.Light,
};
const loaders: CelebrationAssetLoaders = {
  loadAnimationData: vi.fn(async () => ({})),
  resolveImageUrl: (id) => `/assets/${id}`,
};

describe('createCelebrationSceneFromDescriptor', () => {
  it('takes the id, label and lifetime from the descriptor', () => {
    const scene = createCelebrationSceneFromDescriptor(
      packSceneFixture(),
      loaders,
      CONTEXT,
    );
    expect(scene).toMatchObject({
      id: 'snowman-delivery',
      labelId: 'snowmanDeliveryToastMessage',
      durationMs: 15000,
    });
  });
});

describe('replaceCelebrationScenes', () => {
  const snowman = createCelebrationSceneFromDescriptor(
    packSceneFixture({ labelId: 'packLabel' }),
    loaders,
    CONTEXT,
  );

  it('replaces only the matching scene and keeps the event intact', () => {
    const replaced = replaceCelebrationScenes(newYearEvent, [snowman]);
    expect(replaced).not.toBe(newYearEvent);
    expect(replaced.scenes.map(({ id }) => id)).toEqual(
      newYearEvent.scenes.map(({ id }) => id),
    );
    expect(replaced.clickSceneIds).toBe(newYearEvent.clickSceneIds);
    expect(replaced.secretTrigger).toBe(newYearEvent.secretTrigger);
    expect(replaced.Decoration).toBe(newYearEvent.Decoration);
    expect(replaced.labels).toBe(newYearEvent.labels);
    expect(replaced.titleLabelId).toBe(newYearEvent.titleLabelId);
    expect(replaced.iconUrl).toBe(newYearEvent.iconUrl);
    expect(replaced.decorBehaviors).toBe(newYearEvent.decorBehaviors);
    replaced.scenes.forEach((scene, index) => {
      const original = newYearEvent.scenes[index];
      if (scene.id === NewYearScene.SnowmanDelivery) {
        expect(scene.Component).toBe(snowman.Component);
        expect(scene.durationMs).toBe(15000);
        expect(scene.labelId).toBe(original.labelId);
      } else {
        expect(scene).toBe(original);
      }
    });
  });

  it('ignores a replacement whose id the event lacks', () => {
    const unknown = createCelebrationSceneFromDescriptor(
      packSceneFixture({ id: 'sleigh' }),
      loaders,
      CONTEXT,
    );
    const replaced = replaceCelebrationScenes(newYearEvent, [unknown]);
    expect(replaced.scenes).toEqual(newYearEvent.scenes);
  });
});

describe('createCelebrationEventFromDescriptor', () => {
  it('builds an event with a static trigger, filtered pool and no secret', () => {
    const event = createCelebrationEventFromDescriptor(
      externalPackFixture(),
      loaders,
      CONTEXT,
    );
    expect(event.id).toBe('company-anniversary');
    expect(event.clickSceneIds).toEqual(['confetti']);
    expect(event.scenes.map(({ id }) => id)).toEqual(['confetti']);
    expect(event.secretTrigger).toBeUndefined();
    expect(event.decorBehaviors).toBeUndefined();
    expect(event.iconUrl).toBe('/assets/anniversary-icon');
    expect(event.titleLabelId).toBe('title');
    expect(event.labels.trigger).toBe('Play celebration');
  });

  it('throws for a pack without an event block', () => {
    expect(() =>
      createCelebrationEventFromDescriptor(
        externalPackFixture({ event: undefined }),
        loaders,
        CONTEXT,
      ),
    ).toThrow(TypeError);
  });

  it('names its trigger from host labels and plays a scene on keyboard activation', async () => {
    const onNotify = vi.fn();
    const event = createCelebrationEventFromDescriptor(
      externalPackFixture(),
      loaders,
      CONTEXT,
    );
    render(
      <CelebrationProvider
        events={{ 'company-anniversary': async () => event }}
        activeEventId="company-anniversary"
        labels={{ 'company-anniversary': { trigger: 'Celebrate ten years' } }}
        onNotify={onNotify}
      >
        <CelebrationDecor />
      </CelebrationProvider>,
    );
    const trigger = await screen.findByRole('button', {
      name: 'Celebrate ten years',
    });
    expect(trigger.firstElementChild?.getAttribute('src')).toBe(
      '/assets/anniversary-trigger',
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith({
        title: 'Happy anniversary',
        message: 'Thanks for being with us',
      }),
    );
  });
});

describe('addCelebrationScenes', () => {
  const couriers = createCelebrationSceneFromDescriptor(
    packSceneFixture({ id: 'bullfinch-couriers', labelId: 'couriersToast' }),
    loaders,
    CONTEXT,
  );
  const snowman = createCelebrationSceneFromDescriptor(
    packSceneFixture(),
    loaders,
    CONTEXT,
  );

  it('appends a new scene to the scenes and the click pool only', () => {
    const added = addCelebrationScenes(newYearEvent, [couriers], {
      couriersToast: 'Delivered by bullfinches',
    });
    expect(added.scenes.map(({ id }) => id)).toEqual([
      ...newYearEvent.scenes.map(({ id }) => id),
      'bullfinch-couriers',
    ]);
    expect(added.clickSceneIds).toEqual([
      ...newYearEvent.clickSceneIds,
      'bullfinch-couriers',
    ]);
    expect(added.secretTrigger).toBe(newYearEvent.secretTrigger);
    expect(added.decorBehaviors).toBe(newYearEvent.decorBehaviors);
    expect(added.titleLabelId).toBe(newYearEvent.titleLabelId);
    expect(added.labels.couriersToast).toBe('Delivered by bullfinches');
  });

  it('never overrides a bundled label', () => {
    const added = addCelebrationScenes(newYearEvent, [couriers], {
      toastTitle: 'Pack title',
    });
    expect(added.labels.toastTitle).toBe(newYearEvent.labels.toastTitle);
  });

  it('returns the same event when every scene already exists', () => {
    expect(addCelebrationScenes(newYearEvent, [snowman])).toBe(newYearEvent);
  });

  it('plays an added scene from a gift click', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const onNotify = vi.fn();
    const event = addCelebrationScenes(newYearEvent, [couriers], {
      couriersToast: 'Delivered by bullfinches',
    });
    render(
      <CelebrationProvider
        events={{ 'new-year': async () => event }}
        activeEventId="new-year"
        onNotify={onNotify}
      >
        <CelebrationDecor />
      </CelebrationProvider>,
    );
    await userEvent.click(
      await screen.findByRole('button', {
        name: newYearEvent.labels.giftLabel,
      }),
    );
    await waitFor(() =>
      expect(onNotify).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Delivered by bullfinches' }),
      ),
    );
    vi.restoreAllMocks();
  });
});
