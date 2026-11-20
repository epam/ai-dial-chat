import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { externalGiftWrappingScene } from '../test-utils/external-gift-wrapping';
import {
  CelebrationAnchorFallback,
  CelebrationColorScheme,
} from '../types/celebration-pack';
import { createStoryPackLoaders, PackStoryLoader } from './pack-story-loaders';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

interface ExternalGiftWrappingPlayerProps {
  /** Writing direction supplied to the scene. */
  dir: CelebrationTextDirection;
  /** Whether the host page has a composer the scene can measure. */
  hasComposer: boolean;
  /** Whether the host uses its mobile layout. */
  isMobile: boolean;
  /** What happens when no composer is eligible. */
  fallback: CelebrationAnchorFallback;
  /** How the fixture loader behaves. */
  loader: PackStoryLoader;
}

/* The draft the browser checks expect to survive every scene outcome. */
const DRAFT = 'Wrap the presents before midnight';

const ExternalGiftWrappingPlayer: FC<ExternalGiftWrappingPlayerProps> = ({
  dir,
  hasComposer,
  isMobile,
  fallback,
  loader,
}) => {
  const [run, setRun] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [isCachePristine, setIsCachePristine] = useState<boolean>();
  /* One loader set per mode keeps parsed data across replays, as a host does. */
  const loaders = useMemo(
    () =>
      createStoryPackLoaders(loader, () =>
        setRequestCount((value) => value + 1),
      ),
    [loader],
  );
  const anchors = useMemo(
    () => ({
      ...STORY_ANCHORS,
      composer: hasComposer ? STORY_ANCHORS.composer : 'story-missing-composer',
    }),
    [hasComposer],
  );
  const scene = useMemo(() => externalGiftWrappingScene(fallback), [fallback]);
  return (
    <CelebrationProvider
      events={{}}
      activeEventId={null}
      anchors={anchors}
      isMobile={isMobile}
    >
      <div dir={dir}>
        <StoryHostPage composerDefaultValue={DRAFT}>
          <button
            type="button"
            className="min-h-11 rounded border px-3 py-1"
            onClick={() => setRun((value) => value + 1)}
          >
            Replay
          </button>
          <output>Data requests: {requestCount}</output>
          <button
            type="button"
            className="min-h-11 rounded border px-3 py-1"
            onClick={() => setIsCachePristine(loaders.isCachePristine())}
          >
            Check cache
          </button>
          {isCachePristine !== undefined && (
            <output>Cache pristine: {isCachePristine ? 'yes' : 'no'}</output>
          )}
        </StoryHostPage>
      </div>
      {/* `data-story-scene-layer` lets the browser checks find the stage. */}
      <div
        aria-hidden="true"
        data-story-scene-layer
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <LottieScene
          key={`${run}-${dir}-${hasComposer}-${isMobile}-${fallback}-${loader}`}
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
  title: 'Packs/ExternalGiftWrapping',
  component: ExternalGiftWrappingPlayer,
  args: {
    dir: 'ltr',
    hasComposer: true,
    isMobile: false,
    fallback: CelebrationAnchorFallback.StageAnchor,
    loader: PackStoryLoader.Ready,
  },
  argTypes: {
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    fallback: {
      control: 'inline-radio',
      options: Object.values(CelebrationAnchorFallback),
    },
    loader: { control: 'select', options: Object.values(PackStoryLoader) },
  },
} satisfies Meta<typeof ExternalGiftWrappingPlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The published `new-year-default@1.1.1` scene wraps the measured composer. */
export const OnComposer: Story = {};

/** The published mobile variant around its 300 px reference composer. */
export const Mobile: Story = { args: { isMobile: true } };

/** RTL with `mirror`: the published stage flips around the composer's center line. */
export const RtlMirror: Story = { args: { dir: 'rtl' } };

/** No composer: the published scene wraps its parcel around the synthetic anchor. */
export const StageAnchorFallback: Story = { args: { hasComposer: false } };

/** The data misses the load deadline, so the published poster shows. */
export const SlowLoad: Story = { args: { loader: PackStoryLoader.Slow } };

/** The loader rejects at once, so the published poster shows. */
export const BrokenLoad: Story = { args: { loader: PackStoryLoader.Broken } };

/** A cancelled load resolves late and must not start the scene. */
export const LateResolution: Story = {
  args: { loader: PackStoryLoader.IgnoresAbort },
};
