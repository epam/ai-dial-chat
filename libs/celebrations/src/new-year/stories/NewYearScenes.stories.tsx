import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScenePlayer } from '../../stories/ScenePlayer';
import { NewYearScene } from '../components/NewYear/types';
import { newYearEvent } from '../event';

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
