import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScenePlayer } from '../../stories/ScenePlayer';
import { halloweenEvent } from '../event';
import { HalloweenScene } from '../types/halloween';

/* Each story plays its scene on load; Replay runs it again. */
const meta = {
  title: 'Halloween/Scenes',
  component: ScenePlayer,
  args: {
    event: halloweenEvent,
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

export const Ghost: Story = {
  args: { sceneId: HalloweenScene.Ghost },
  parameters: { celebrationScene: HalloweenScene.Ghost },
};

export const Web: Story = {
  args: { sceneId: HalloweenScene.Web },
  parameters: { celebrationScene: HalloweenScene.Web },
};

export const Bats: Story = {
  args: { sceneId: HalloweenScene.Bats },
  parameters: { celebrationScene: HalloweenScene.Bats },
};

export const Cat: Story = {
  args: { sceneId: HalloweenScene.Cat },
  parameters: { celebrationScene: HalloweenScene.Cat },
};

export const Witches: Story = {
  args: { sceneId: HalloweenScene.Witches },
  parameters: { celebrationScene: HalloweenScene.Witches },
};

export const Train: Story = {
  args: { sceneId: HalloweenScene.Train },
  parameters: { celebrationScene: HalloweenScene.Train },
};

export const Portal: Story = {
  args: { sceneId: HalloweenScene.Portal },
  parameters: { celebrationScene: HalloweenScene.Portal },
};

export const Ravens: Story = {
  args: { sceneId: HalloweenScene.Ravens },
  parameters: { celebrationScene: HalloweenScene.Ravens },
};

export const Candy: Story = {
  args: { sceneId: HalloweenScene.Candy },
  parameters: { celebrationScene: HalloweenScene.Candy },
};

export const Footprints: Story = {
  args: { sceneId: HalloweenScene.Footprints },
  parameters: { celebrationScene: HalloweenScene.Footprints },
};

export const Skeletons: Story = {
  args: { sceneId: HalloweenScene.Skeletons },
  parameters: { celebrationScene: HalloweenScene.Skeletons },
};

export const Spiders: Story = {
  args: { sceneId: HalloweenScene.Spiders },
  parameters: { celebrationScene: HalloweenScene.Spiders },
};

export const Cauldron: Story = {
  args: { sceneId: HalloweenScene.Cauldron },
  parameters: { celebrationScene: HalloweenScene.Cauldron },
};

export const Mimic: Story = {
  args: { sceneId: HalloweenScene.Mimic },
  parameters: { celebrationScene: HalloweenScene.Mimic },
};

export const Bowling: Story = {
  args: { sceneId: HalloweenScene.Bowling },
  parameters: { celebrationScene: HalloweenScene.Bowling },
};

export const Mummy: Story = {
  args: { sceneId: HalloweenScene.Mummy },
  parameters: { celebrationScene: HalloweenScene.Mummy },
};
