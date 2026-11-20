import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type FC } from 'react';
import {
  CONVERSATION_INPUT_ANCHORS,
  ConversationInputHostPage,
} from './ConversationInputHostPage';
import {
  BenchmarkScene,
  catBorrowBenchmarkCases,
  giftWrappingBenchmarkCases,
  runPreparationBenchmark,
  type PreparationBenchmarkResult,
} from './preparation-benchmark';
import { STORY_ANCHORS, StoryHostPage } from './StoryHostPage';

interface PreparationBenchmarkPlayerProps {
  /** Scene to time. */
  scene: BenchmarkScene;
  /** Whether to time the mobile variant against the phone layout. */
  isMobile: boolean;
  /** Timed runs per case. */
  runs: number;
}

const PreparationBenchmarkPlayer: FC<PreparationBenchmarkPlayerProps> = ({
  scene,
  isMobile,
  runs,
}) => {
  const [results, setResults] = useState<PreparationBenchmarkResult[]>();
  const isCat = scene === BenchmarkScene.Cat;
  const handleRun = () =>
    setResults(
      runPreparationBenchmark(
        isCat
          ? catBorrowBenchmarkCases(CONVERSATION_INPUT_ANCHORS, isMobile)
          : giftWrappingBenchmarkCases(STORY_ANCHORS.composer, isMobile),
        runs,
      ),
    );
  const controls = (
    <>
      <button
        type="button"
        className="min-h-11 rounded border px-3 py-1"
        onClick={handleRun}
      >
        Run benchmark
      </button>
      {/* JSON so the browser check reads exact numbers. */}
      <output aria-label="Benchmark results" className="max-w-full break-all">
        {results ? JSON.stringify(results) : ''}
      </output>
    </>
  );
  return isCat ? (
    <ConversationInputHostPage isMobile={isMobile}>
      {controls}
    </ConversationInputHostPage>
  ) : (
    <StoryHostPage>{controls}</StoryHostPage>
  );
};

const meta = {
  title: 'Packs/PreparationBenchmark',
  component: PreparationBenchmarkPlayer,
  args: { scene: BenchmarkScene.GiftWrapping, isMobile: false, runs: 20 },
} satisfies Meta<typeof PreparationBenchmarkPlayer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Times the published GiftWrapping preparation on the live composer. */
export const Default: Story = {};

/** The mobile variant against the phone layout. */
export const Mobile: Story = { args: { isMobile: true } };

/** Times the cat-borrow preparation of the spike clip and the full asset on the real composer. */
export const Cat: Story = { args: { scene: BenchmarkScene.Cat } };

/** The cat-borrow preparations at the 0.8 mobile scale. */
export const CatMobile: Story = {
  args: { scene: BenchmarkScene.Cat, isMobile: true },
};
