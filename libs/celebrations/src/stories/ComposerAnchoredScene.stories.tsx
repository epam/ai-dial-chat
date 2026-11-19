import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { packSceneFixture } from '../test-utils/pack-fixtures';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationCapability,
  CelebrationColorScheme,
  CelebrationDirectionMode,
  CelebrationPlacementTemplate,
} from '../types/celebration-pack';
import { createStoryPackLoaders, PackStoryLoader } from './pack-story-loaders';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

interface ComposerAnchoredScenePlayerProps {
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

const ComposerAnchoredScenePlayer: FC<ComposerAnchoredScenePlayerProps> = ({
  dir,
  hasComposer,
  isMobile,
  fallback,
  loader,
}) => {
  const [run, setRun] = useState(0);
  const loaders = useMemo(() => createStoryPackLoaders(loader), [loader]);
  const anchors = useMemo(
    () => ({
      ...STORY_ANCHORS,
      composer: hasComposer ? STORY_ANCHORS.composer : 'story-missing-composer',
    }),
    [hasComposer],
  );
  const scene = useMemo(
    () =>
      packSceneFixture({
        id: 'composer-anchored-fixture',
        requiredCapabilities: [
          CelebrationCapability.LottieLightSvgV1,
          CelebrationCapability.ComposerAnchorV1,
          CelebrationCapability.InteractionComposerOutlineV1,
          CelebrationCapability.StaticPosterV1,
        ],
        placement: {
          template: CelebrationPlacementTemplate.ComposerAnchorV1,
          anchor: CelebrationAnchor.Composer,
          anchorRect: { x: 340, y: 164, width: 520, height: 56 },
          edge: CelebrationAnchorEdge.Top,
          scale: { min: 0.6, max: 1 },
          fallback,
        },
        direction: CelebrationDirectionMode.Mirror,
        timing: {
          playbackDurationMs: 4000,
          loadTimeoutMs: 2000,
          readyTimeoutMs: 250,
          maxLifetimeMs: 6250,
        },
        posterAssetId: 'fixture-poster',
        posterDurationMs: 3000,
        variants: [{ when: {}, animationAssetId: 'anchored-fixture' }],
      }),
    [fallback],
  );
  return (
    <CelebrationProvider
      events={{}}
      activeEventId={null}
      anchors={anchors}
      isMobile={isMobile}
    >
      <div dir={dir}>
        <StoryHostPage>
          <button
            type="button"
            className="min-h-11 rounded border px-3 py-1"
            onClick={() => setRun((value) => value + 1)}
          >
            Replay
          </button>
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
  title: 'Packs/ComposerAnchoredScene',
  component: ComposerAnchoredScenePlayer,
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
} satisfies Meta<typeof ComposerAnchoredScenePlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The fixture ribbon traces the measured composer while the hopper keeps its authored size. */
export const OnComposer: Story = {};

/** RTL with `mirror`: the stage flips around the composer's center line. */
export const RtlMirror: Story = { args: { dir: 'rtl' } };

/** The phone layout: the same stage scales down with the narrower composer. */
export const Mobile: Story = { args: { isMobile: true } };

/** No composer: the scene plays around the synthetic anchor with its parcel. */
export const StageAnchorFallback: Story = { args: { hasComposer: false } };

/** No composer and `fallback: poster`: only the poster shows. */
export const PosterFallback: Story = {
  args: { hasComposer: false, fallback: CelebrationAnchorFallback.Poster },
};
