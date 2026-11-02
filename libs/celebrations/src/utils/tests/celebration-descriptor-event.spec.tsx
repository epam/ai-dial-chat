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
