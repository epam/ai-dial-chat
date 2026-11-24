import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type CSSProperties, type FC } from 'react';
import { LottieScene } from '../components/LottieScene/LottieScene';
import { CelebrationProvider } from '../context/CelebrationContext';
import type { CelebrationTextDirection } from '../models/celebration-pack';
import { santaHistoryDeliveryScene } from '../test-utils/santa-history-delivery';
import { santaHistoryFullScene } from '../test-utils/santa-history-full';
import { CelebrationColorScheme } from '../types/celebration-pack';
import { createStoryPackLoaders, PackStoryLoader } from './pack-story-loaders';

const ANCHORS = {
  historyContainer: 'santa-history-fixture',
  historyRowLink: 'a[data-history-link]',
  composer: 'santa-history-composer',
  composerAddCluster: 'santa-history-add',
  composerModelSelector: 'santa-history-model',
  starterList: 'santa-history-starters',
  welcomeRegion: '.santa-history-welcome',
};
const TITLES = [
  'Holiday plans',
  'A winter walk',
  'Gift ideas',
  'A family dinner',
  'Travel notes',
  'New Year wishes',
];

interface SantaHistoryPlayerProps {
  fullStory: boolean;
  dir: CelebrationTextDirection;
  isMobile: boolean;
  colorScheme: CelebrationColorScheme;
  hasHistory: boolean;
  isEmptyHistory: boolean;
  isIrregularHistory: boolean;
  isDocked: boolean;
  loader: PackStoryLoader;
}

/* Plain controls belong to the scene test fixture and never ship as product UI. */
const SantaHistoryPlayer: FC<SantaHistoryPlayerProps> = ({
  fullStory,
  dir,
  isMobile,
  colorScheme,
  hasHistory,
  isEmptyHistory,
  isIrregularHistory,
  isDocked,
  loader,
}) => {
  const [run, setRun] = useState(0);
  const [requests, setRequests] = useState(0);
  const [cachePristine, setCachePristine] = useState<boolean>();
  const loaders = useMemo(
    () =>
      createStoryPackLoaders(loader, () => setRequests((count) => count + 1)),
    [loader],
  );
  const scene = useMemo(
    () => (fullStory ? santaHistoryFullScene() : santaHistoryDeliveryScene()),
    [fullStory],
  );
  const dark = colorScheme === CelebrationColorScheme.Dark;
  const theme = {
    '--bg-layer-1': dark ? '#171c29' : '#f4f5f8',
    '--bg-layer-base': dark ? '#171c29' : '#f4f5f8',
    '--text-primary': dark ? '#edf0f7' : '#161b2d',
    '--stroke-primary': dark ? '#66748e' : '#bdc5d3',
    colorScheme,
  } as CSSProperties;
  return (
    <CelebrationProvider
      events={{}}
      activeEventId={null}
      anchors={ANCHORS}
      isMobile={isMobile}
    >
      <div
        dir={dir}
        style={theme}
        className="relative h-dvh min-w-0 overflow-hidden bg-layer-base text-primary"
      >
        <div className="fixed inset-s-3 inset-e-3 top-3 z-10 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="min-h-11 rounded border px-3"
            onClick={() => setRun((value) => value + 1)}
          >
            Replay Santa
          </button>
          <button
            type="button"
            className="min-h-11 rounded border px-3"
            onClick={() => setCachePristine(loaders.isCachePristine())}
          >
            Check cache
          </button>
          <output>Data requests: {requests}</output>
          {cachePristine !== undefined && (
            <output>Cache pristine: {cachePristine ? 'yes' : 'no'}</output>
          )}
        </div>
        <nav
          aria-label="Conversation history"
          className="santa-history-fixture absolute inset-s-4 w-52"
          style={{ top: 100, display: hasHistory ? undefined : 'none' }}
        >
          <h2 className="mb-4 w-fit">Your conversations</h2>
          <ul className="flex flex-col gap-2">
            {!isEmptyHistory &&
              TITLES.map((title, index) => (
                <li
                  key={title}
                  className="rounded border px-2"
                  style={{
                    height: 36,
                    marginTop: isIrregularHistory && index === 3 ? 110 : 0,
                  }}
                >
                  <a
                    data-history-link
                    href={`#history-${index}`}
                    className="block h-full truncate leading-8"
                    onClick={(event) => event.preventDefault()}
                  >
                    {title}
                  </a>
                </li>
              ))}
          </ul>
        </nav>
        <main
          className="santa-history-welcome absolute inset-s-4 inset-e-4 desktop:inset-s-80"
          style={{
            top: isDocked ? undefined : '66%',
            bottom: isDocked ? 16 : undefined,
          }}
        >
          <h1 className="mb-3 text-center">How can I help you today?</h1>
          <div className="santa-history-composer mx-auto max-w-xl rounded border p-3">
            <textarea
              aria-label="Message"
              defaultValue="My draft stays right here"
              className="block w-full resize-none bg-transparent"
              rows={2}
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                className="santa-history-add rounded border px-2 py-1"
              >
                Add
              </button>
              <button
                type="button"
                className="santa-history-model rounded border px-2 py-1"
              >
                Model
              </button>
            </div>
          </div>
          <ul className="santa-history-starters mt-3 flex justify-center gap-2">
            <li>
              <button type="button" className="rounded border px-2 py-1">
                Write a poem
              </button>
            </li>
            <li>
              <button type="button" className="rounded border px-2 py-1">
                Plan my evening
              </button>
            </li>
          </ul>
        </main>
      </div>
      <div
        aria-hidden="true"
        data-story-scene-layer
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <LottieScene
          key={`${run}-${fullStory}-${dir}-${isMobile}-${colorScheme}-${hasHistory}-${isEmptyHistory}-${isIrregularHistory}-${isDocked}-${loader}`}
          scene={scene}
          loaders={loaders}
          context={{ direction: dir, colorScheme }}
        />
      </div>
    </CelebrationProvider>
  );
};

const meta = {
  title: 'Packs/SantaHistoryDelivery',
  component: SantaHistoryPlayer,
  parameters: { layout: 'fullscreen' },
  args: {
    fullStory: false,
    dir: 'ltr',
    isMobile: false,
    colorScheme: CelebrationColorScheme.Light,
    hasHistory: true,
    isEmptyHistory: false,
    isIrregularHistory: false,
    isDocked: false,
    loader: PackStoryLoader.Ready,
  },
  argTypes: {
    dir: { control: 'select', options: ['ltr', 'rtl'] },
    colorScheme: {
      control: 'select',
      options: Object.values(CelebrationColorScheme),
    },
    loader: { control: 'select', options: Object.values(PackStoryLoader) },
  },
} satisfies Meta<typeof SantaHistoryPlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** First native interaction, before the gift/phone/rescue ending is added. */
export const RepresentativeInteraction: Story = {};
export const RopeDescent: Story = {
  args: { hasHistory: false, isMobile: true },
};
export const RightToLeft: Story = { args: { dir: 'rtl' } };
export const Dark: Story = {
  args: { colorScheme: CelebrationColorScheme.Dark },
};

/** Full native gifts, phone call, boarding and reindeer departure. */
export const FullStory: Story = { args: { fullStory: true } };
