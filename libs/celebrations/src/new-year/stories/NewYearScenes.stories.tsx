import type { Meta, StoryObj } from '@storybook/react-vite';
import { waitFor } from 'storybook/test';
import { ScenePlayer } from '../../stories/ScenePlayer';
import { newYearEvent } from '../event';
import { NewYearScene } from '../types/new-year';

/* Each story plays its scene on load; Replay runs it again. */
const meta = {
  title: 'New Year/Scenes',
  component: ScenePlayer,
  args: {
    event: newYearEvent,
    isMobile: false,
    dir: 'ltr',
    isReducedMotion: false,
  },
  argTypes: {
    event: { table: { disable: true } },
    sceneId: { control: false },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
} satisfies Meta<typeof ScenePlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PenguinStar: Story = {
  args: { sceneId: NewYearScene.PenguinStar },
  parameters: { celebrationScene: NewYearScene.PenguinStar },
};

export const PenguinStarMobile: Story = {
  args: {
    sceneId: NewYearScene.PenguinStar,
    isMobile: true,
    showStarters: false,
  },
};

export const PenguinStarRtl: Story = {
  args: { sceneId: NewYearScene.PenguinStar, dir: 'rtl' },
};

export const PenguinStarReducedMotion: Story = {
  args: { sceneId: NewYearScene.PenguinStar, isReducedMotion: true },
};

/** The garland and the gift trigger; press the gift to play a scene. */
export const Decor: Story = {
  parameters: { celebrationDecor: 'new-year' },
};

export const ReindeerTakeoff: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    startersBelowComposer: true,
  },
  parameters: { celebrationScene: NewYearScene.ReindeerTakeoff },
};
export const ReindeerTakeoffMobile: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    isMobile: true,
    startersBelowComposer: true,
  },
};
export const ReindeerTakeoffRtl: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    dir: 'rtl',
    startersBelowComposer: true,
  },
};
export const ReindeerTakeoffReducedMotion: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    isReducedMotion: true,
  },
};
export const ReindeerTakeoffDraft: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    showStarters: false,
    composerValue: 'Winter wishes stay in my draft',
  },
};
export const ReindeerTakeoffBottomComposer: Story = {
  args: {
    sceneId: NewYearScene.ReindeerTakeoff,
    composerPlaceholder: 'Type a message',
    composerAlign: 'bottom',
  },
};

export const GiftWrapping: Story = {
  args: { sceneId: NewYearScene.GiftWrapping },
  parameters: { celebrationScene: NewYearScene.GiftWrapping },
};

export const GiftWrappingMobile: Story = {
  args: {
    sceneId: NewYearScene.GiftWrapping,
    isMobile: true,
    showStarters: false,
  },
};

export const GiftWrappingRtl: Story = {
  args: { sceneId: NewYearScene.GiftWrapping, dir: 'rtl' },
};

export const GiftWrappingReducedMotion: Story = {
  args: { sceneId: NewYearScene.GiftWrapping, isReducedMotion: true },
};

/** Default chat layout: starters below the composer, a ledge under the row. */
export const SnowmanDelivery: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery, startersBelowComposer: true },
  parameters: { celebrationScene: NewYearScene.SnowmanDelivery },
};

/** Starters between the greeting and the composer: the ride uses the composer rim. */
export const SnowmanDeliveryStartersAbove: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery },
};

export const SnowmanDeliveryMobile: Story = {
  args: {
    sceneId: NewYearScene.SnowmanDelivery,
    isMobile: true,
    startersBelowComposer: true,
  },
};

export const SnowmanDeliveryRtl: Story = {
  args: {
    sceneId: NewYearScene.SnowmanDelivery,
    dir: 'rtl',
    startersBelowComposer: true,
  },
};

export const SnowmanDeliveryReducedMotion: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery, isReducedMotion: true },
};

/** No starters to borrow: the same story with a drawn sled on the rim. */
export const SnowmanDeliveryNoStarters: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery, showStarters: false },
};

/** Composer and starters pinned to the bottom: no stage fits, so the still shows. */
export const SnowmanDeliveryUnsuitableGeometry: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery, composerAlign: 'bottom' },
};

/** Clicking the page mid-ride ends the scene and the original card is back at once. */
export const SnowmanDeliveryInterruption: Story = {
  args: { sceneId: NewYearScene.SnowmanDelivery, startersBelowComposer: true },
  play: async ({ canvasElement }) => {
    const scene = await waitFor(
      () => {
        const found = canvasElement.ownerDocument.querySelector(
          '[data-new-year-scene="snowman-delivery"]',
        );
        if (!found) throw new Error('Scene not started');
        return found;
      },
      { timeout: 5000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
    canvasElement.ownerDocument.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    );
    await waitFor(() => {
      if (scene.isConnected) throw new Error('Scene still running');
      if (
        canvasElement.ownerDocument.querySelector('[data-celebration-snapshot]')
      )
        throw new Error('A card copy remains');
    });
  },
};
