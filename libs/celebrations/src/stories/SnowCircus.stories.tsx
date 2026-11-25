import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { snowCircusLoaders, snowCircusScene } from '../test-utils/snow-circus';
import { CelebrationColorScheme } from '../types/celebration-pack';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

interface SnowCircusPlayerProps {
  /** Writing direction of the host. */
  dir: CelebrationTextDirection;
  /** Restricts borrowing to one small button. */
  isMobile: boolean;
  /** Uses the drawn snow alternative when false. */
  hasComposer: boolean;
}

const SnowCircusPlayer: FC<SnowCircusPlayerProps> = ({
  dir,
  isMobile,
  hasComposer,
}) => {
  const [run, setRun] = useState(0);
  const anchors = useMemo(
    () => ({
      ...STORY_ANCHORS,
      composer: hasComposer ? STORY_ANCHORS.composer : 'missing-composer',
    }),
    [hasComposer],
  );
  return (
    <CelebrationProvider
      events={{}}
      activeEventId={null}
      anchors={anchors}
      isMobile={isMobile}
    >
      <div dir={dir}>
        <StoryHostPage
          composerDefaultValue="My draft stays here"
          startersBelowComposer
        >
          <button
            type="button"
            className="min-h-11 rounded border px-3 py-1"
            onClick={() => setRun((value) => value + 1)}
          >
            Replay Snow Circus
          </button>
        </StoryHostPage>
      </div>
      <div
        aria-hidden="true"
        data-story-scene-layer
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <LottieScene
          key={`${run}-${dir}-${hasComposer}-${isMobile}`}
          scene={snowCircusScene}
          loaders={snowCircusLoaders}
          context={{
            direction: dir,
            colorScheme: CelebrationColorScheme.Light,
          }}
        />
      </div>
    </CelebrationProvider>
  );
};

const meta = {
  title: 'New Year/Snow Circus',
  component: SnowCircusPlayer,
  args: { dir: 'ltr', isMobile: false, hasComposer: true },
} satisfies Meta<typeof SnowCircusPlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Two small interface buttons become snowballs and are returned. */
export const Desktop: Story = {};
/** The complete two-character story with one copied button. */
export const Mobile: Story = { args: { isMobile: true } };
/** Copies retain their text direction and measured physical positions. */
export const Rtl: Story = { args: { dir: 'rtl' } };
/** No eligible composer: the cast plays with drawn snow. */
export const MissingTargets: Story = { args: { hasComposer: false } };
