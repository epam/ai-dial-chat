import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { CelebrationColorScheme } from '../types/celebration-pack';
import {
  CAT_BORROW_DRAFT,
  CAT_BORROW_FULL_SCENE,
  CAT_BORROW_SPIKE_SCENE,
  CatAsset,
  catBorrowKnobStyles,
  CatButtons,
  SpikeButtonHeight,
} from './cat-borrow-scenes';
import {
  CONVERSATION_INPUT_ANCHORS,
  ConversationInputHostPage,
} from './ConversationInputHostPage';
import { createStoryPackLoaders, PackStoryLoader } from './pack-story-loaders';

interface CatBorrowSpikePlayerProps {
  /** The spike clip or the full 25 s asset. */
  asset: CatAsset;
  /** Borrowable buttons: two (all), one (add only) or none (crossing). */
  buttons: CatButtons;
  /** Writing direction of the page. */
  dir: CelebrationTextDirection;
  /** Whether the host uses its mobile layout. */
  isMobile: boolean;
  /** Composer button height. */
  buttonHeight: SpikeButtonHeight;
  /** Whether the starters sit under the composer's trailing buttons, so a copy lands on one. */
  hasSupport: boolean;
  /** How the fixture loader behaves. */
  loader: PackStoryLoader;
}

const CatBorrowSpikePlayer: FC<CatBorrowSpikePlayerProps> = ({
  asset,
  buttons,
  dir,
  isMobile,
  buttonHeight,
  hasSupport,
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
  return (
    <CelebrationProvider
      events={{}}
      activeEventId={null}
      anchors={CONVERSATION_INPUT_ANCHORS}
      isMobile={isMobile}
    >
      <style>{catBorrowKnobStyles(buttonHeight, hasSupport, buttons)}</style>
      <div dir={dir}>
        <ConversationInputHostPage isMobile={isMobile} draft={CAT_BORROW_DRAFT}>
          {/* One row, so the controls never move the composer. */}
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </ConversationInputHostPage>
      </div>
      {/* `data-story-scene-layer` lets the browser checks find the stage. */}
      <div
        aria-hidden="true"
        data-story-scene-layer
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <LottieScene
          key={`${run}-${asset}-${buttons}-${dir}-${isMobile}-${buttonHeight}-${hasSupport}-${loader}`}
          scene={
            asset === CatAsset.Full
              ? CAT_BORROW_FULL_SCENE
              : CAT_BORROW_SPIKE_SCENE
          }
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
  title: 'Packs/CatBorrowSpike',
  component: CatBorrowSpikePlayer,
  args: {
    asset: CatAsset.Spike,
    buttons: CatButtons.All,
    dir: 'ltr',
    isMobile: false,
    buttonHeight: SpikeButtonHeight.Real,
    hasSupport: false,
    loader: PackStoryLoader.Ready,
  },
  argTypes: {
    asset: { control: 'inline-radio', options: Object.values(CatAsset) },
    buttons: { control: 'inline-radio', options: Object.values(CatButtons) },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    buttonHeight: {
      control: 'inline-radio',
      options: Object.values(SpikeButtonHeight),
    },
    loader: { control: 'select', options: Object.values(PackStoryLoader) },
  },
} satisfies Meta<typeof CatBorrowSpikePlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** S4 spike: hop down, nudge, push, fall to the floor, rebound and recoil on the real composer. */
export const Desktop: Story = {};

/** The mobile layout plays the same asset at 0.8 scale. */
export const Mobile: Story = { args: { isMobile: true } };

/** The copy lands on a starter button instead of the floor. */
export const OnSupport: Story = { args: { hasSupport: true } };

/** RTL: sides come from physical geometry and the copy's text is never mirrored. */
export const Rtl: Story = { args: { dir: 'rtl' } };

/** The full 25 s asset with two borrowable buttons. */
export const FullTwoButtons: Story = { args: { asset: CatAsset.Full } };

/** The full asset with only the add button: the one-button story. */
export const FullOneButton: Story = {
  args: { asset: CatAsset.Full, buttons: CatButtons.AddOnly },
};

/** The full asset with nothing borrowable: the crossing walk. */
export const FullCrossing: Story = {
  args: { asset: CatAsset.Full, buttons: CatButtons.None },
};

/** The full asset on the phone layout at 0.8 scale. */
export const FullMobile: Story = {
  args: { asset: CatAsset.Full, isMobile: true },
};

/** The full asset in RTL. */
export const FullRtl: Story = { args: { asset: CatAsset.Full, dir: 'rtl' } };
