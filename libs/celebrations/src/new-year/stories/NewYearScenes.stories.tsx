import type { Meta, StoryObj } from '@storybook/react-vite';
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

export const Snow: Story = {
  args: { sceneId: NewYearScene.Snow },
  parameters: { celebrationScene: NewYearScene.Snow },
};

export const Confetti: Story = {
  args: { sceneId: NewYearScene.Confetti },
  parameters: { celebrationScene: NewYearScene.Confetti },
};

export const Sleigh: Story = {
  args: { sceneId: NewYearScene.Sleigh },
  parameters: { celebrationScene: NewYearScene.Sleigh },
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
