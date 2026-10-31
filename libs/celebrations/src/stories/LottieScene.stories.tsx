import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { packSceneFixture } from '../test-utils/pack-fixtures';
import {
  CelebrationColorScheme,
  CelebrationDirectionMode,
  CelebrationStageAlign,
  CelebrationStageFit,
} from '../types/celebration-pack';
import { createStoryPackLoaders } from './pack-story-loaders';

interface LottieScenePlayerProps {
  /** Writing direction supplied to the scene. */
  dir: CelebrationTextDirection;
  /** Stage alignment. */
  align: CelebrationStageAlign;
  /** Stage fit. */
  fit: CelebrationStageFit;
  /** RTL handling. */
  direction: CelebrationDirectionMode;
  /** Whether the fixture loader rejects, so the poster shows. */
  shouldFail: boolean;
}

const LottieScenePlayer: FC<LottieScenePlayerProps> = ({
  dir,
  align,
  fit,
  direction,
  shouldFail,
}) => {
  const [run, setRun] = useState(0);
  const loaders = useMemo(
    () => createStoryPackLoaders(shouldFail),
    [shouldFail],
  );
  const scene = useMemo(
    () =>
      packSceneFixture({
        placement: { ...packSceneFixture().placement, align, fit },
        direction,
        timing: {
          playbackDurationMs: 3000,
          loadTimeoutMs: 2000,
          readyTimeoutMs: 250,
          maxLifetimeMs: 5250,
        },
        posterAssetId: 'fixture-poster',
        posterDurationMs: 3000,
        variants: [{ when: {}, animationAssetId: 'fixture' }],
      }),
    [align, fit, direction],
  );
  return (
    <CelebrationProvider events={{}} activeEventId={null}>
      <button
        type="button"
        className="m-4 rounded border px-3 py-1"
        onClick={() => setRun((value) => value + 1)}
      >
        Replay
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <LottieScene
          key={`${run}-${dir}-${align}-${fit}-${direction}-${shouldFail}`}
          scene={scene}
          loaders={loaders}
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
  title: 'Packs/LottieScene',
  component: LottieScenePlayer,
  args: {
    dir: 'ltr',
    align: CelebrationStageAlign.Bottom,
    fit: CelebrationStageFit.Contain,
    direction: CelebrationDirectionMode.Mirror,
    shouldFail: false,
  },
  argTypes: {
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    align: { control: 'select', options: Object.values(CelebrationStageAlign) },
    fit: {
      control: 'inline-radio',
      options: Object.values(CelebrationStageFit),
    },
    direction: {
      control: 'inline-radio',
      options: Object.values(CelebrationDirectionMode),
    },
  },
} satisfies Meta<typeof LottieScenePlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The fixture clip plays once on a contain-fitted, bottom-aligned stage. */
export const Playing: Story = {};

/** RTL with `mirror`: the stage flips and `bottom-start` anchors to the right. */
export const RtlMirror: Story = {
  args: { dir: 'rtl', align: CelebrationStageAlign.BottomStart },
};

/** The loader rejects before playback, so the poster shows for its duration. */
export const PosterOnFailure: Story = {
  args: { shouldFail: true },
};
