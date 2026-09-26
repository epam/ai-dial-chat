import type { Meta, StoryObj } from '@storybook/react-vite';
import { HalloweenBehaviorPlayer } from '../../stories/HalloweenBehaviorPlayer';
import { ScenePlayer } from '../../stories/ScenePlayer';
import { halloweenEvent } from '../event';
import { HalloweenDecorBehavior } from '../types/halloween';

const meta = {
  title: 'Halloween/Decor',
  component: HalloweenBehaviorPlayer,
  args: { dir: 'ltr' },
  argTypes: {
    behavior: { control: false },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
} satisfies Meta<typeof HalloweenBehaviorPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The web, the corner spider with every behavior on, and the pumpkin trigger. */
export const Decor: Story = {
  args: { behavior: HalloweenDecorBehavior.SpiderFlee },
  parameters: { celebrationDecor: 'halloween' },
  render: ({ dir }) => <ScenePlayer event={halloweenEvent} dir={dir} />,
};

/** Move the pointer towards the spider: it freezes, then bolts away. */
export const SpiderFlee: Story = {
  args: { behavior: HalloweenDecorBehavior.SpiderFlee },
  parameters: { celebrationBehavior: HalloweenDecorBehavior.SpiderFlee },
};

/** Keep the pointer away: every couple of seconds the spider drops on a thread. */
export const SpiderDrop: Story = {
  args: { behavior: HalloweenDecorBehavior.SpiderDrop },
  parameters: { celebrationBehavior: HalloweenDecorBehavior.SpiderDrop },
};

/** Type in the composer: the spider drums its legs with every key. */
export const SpiderDrum: Story = {
  args: { behavior: HalloweenDecorBehavior.SpiderDrum },
  parameters: { celebrationBehavior: HalloweenDecorBehavior.SpiderDrum },
};

/** Leave the page alone for three seconds: the spider wraps the pumpkin. */
export const PumpkinWrap: Story = {
  args: { behavior: HalloweenDecorBehavior.PumpkinWrap, wrapIdleMs: 3000 },
  parameters: { celebrationBehavior: HalloweenDecorBehavior.PumpkinWrap },
};
