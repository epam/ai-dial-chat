import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type FC } from 'react';
import { StaticTriggerDecoration } from '../components/StaticTriggerDecoration/StaticTriggerDecoration';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { createStoryPackLoaders } from './pack-story-loaders';

interface StaticTriggerPlayerProps {
  /** Writing direction of the surrounding page. */
  dir: CelebrationTextDirection;
  /** Resolved accessible name; empty falls back to the English default. */
  label: string;
}

const loaders = createStoryPackLoaders();

const StaticTriggerPlayer: FC<StaticTriggerPlayerProps> = ({ dir, label }) => {
  const [count, setCount] = useState(0);
  return (
    <div dir={dir} className="flex items-center gap-3 p-6">
      <StaticTriggerDecoration
        onActivate={() => setCount((value) => value + 1)}
        imageUrl={loaders.resolveImageUrl('fixture-trigger')}
        label={label}
      />
      <output aria-live="polite">Activated {count} times</output>
    </div>
  );
};

const meta = {
  title: 'Packs/StaticTriggerDecoration',
  component: StaticTriggerPlayer,
  args: { dir: 'ltr', label: 'Celebrate ten years' },
  argTypes: { dir: { control: 'inline-radio', options: ['ltr', 'rtl'] } },
} satisfies Meta<typeof StaticTriggerPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click, or focus it and press Enter or Space. */
export const Default: Story = {};

/** An empty pack label falls back to `Play celebration`. */
export const DefaultLabel: Story = { args: { label: '' } };
