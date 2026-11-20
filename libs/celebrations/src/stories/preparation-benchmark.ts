import type { CelebrationAnchors } from '../models/celebration';
import type { CelebrationComposerAnchorPlacement } from '../models/celebration-pack';
import {
  EXTERNAL_GIFT_WRAPPING_ASSETS,
  externalGiftWrappingScene,
} from '../test-utils/external-gift-wrapping';
import { CelebrationPlacementTemplate } from '../types/celebration-pack';
import { prepareCatBorrowScene } from '../utils/cat-borrow-adapter';
import { prepareAnchoredSceneData } from '../utils/celebration-pack-scene';
import {
  CAT_BORROW_ASSET_IDS,
  CatAsset,
  catBorrowLayoutPlacement,
} from './cat-borrow-scenes';
import catBorrowFull from './fixtures/cat-borrow-full.lottie.json';
import catBorrowSpike from './fixtures/cat-borrow-spike.lottie.json';
import giftWrappingDesktop from './fixtures/external/gift-wrapping.desktop.28260bbcf8f593a6.json';
import giftWrappingMobile from './fixtures/external/gift-wrapping.mobile.3d541976f665e859.json';

/** Which scene's preparation the benchmark story times. */
export enum BenchmarkScene {
  GiftWrapping = 'gift-wrapping',
  Cat = 'cat',
}

/** One preparation the benchmark story times. */
export interface PreparationBenchmarkCase {
  /** Name shown in the results and read by the browser check. */
  id: string;
  /** Runs one preparation on the live page, exactly as the scene would. */
  prepare: () => void;
}

/** Timings of one case, in milliseconds. */
export interface PreparationBenchmarkResult {
  /** Case name. */
  id: string;
  /** Number of timed runs. */
  runs: number;
  /** The first run, which includes warm-up. */
  firstMs: number;
  /** Median over all runs (nearest rank). */
  p50Ms: number;
  /** 95th percentile over all runs (nearest rank). */
  p95Ms: number;
}

const quantile = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/**
 * Times `runs` preparations of each case. Before every run it invalidates
 * style on `<body>`, so the measurement pays for the forced style and layout
 * a scene meets right after its data loads, never a warm, clean layout.
 */
export const runPreparationBenchmark = (
  cases: readonly PreparationBenchmarkCase[],
  runs = 20,
): PreparationBenchmarkResult[] =>
  cases.map(({ id, prepare }) => {
    const durations: number[] = [];
    for (let index = 0; index < runs; index++) {
      document.body.style.setProperty('--preparation-benchmark', String(index));
      const start = performance.now();
      prepare();
      durations.push(performance.now() - start);
    }
    document.body.style.removeProperty('--preparation-benchmark');
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      id,
      runs,
      firstMs: durations[0],
      p50Ms: quantile(sorted, 0.5),
      p95Ms: quantile(sorted, 0.95),
    };
  });

const giftWrappingPlacement = (
  isMobile: boolean,
): CelebrationComposerAnchorPlacement => {
  const scene = externalGiftWrappingScene();
  const placement = isMobile
    ? (scene.variants[1].placement ?? scene.placement)
    : scene.placement;
  if (placement.template !== CelebrationPlacementTemplate.ComposerAnchorV1)
    throw new Error('GiftWrapping is composer-anchored');
  return placement;
};

/** The published GiftWrapping preparation on the live story composer. */
export const giftWrappingBenchmarkCases = (
  composerClass: string | undefined,
  isMobile: boolean,
): PreparationBenchmarkCase[] => {
  const placement = giftWrappingPlacement(isMobile);
  const data = isMobile ? giftWrappingMobile : giftWrappingDesktop;
  const asset = isMobile
    ? EXTERNAL_GIFT_WRAPPING_ASSETS.mobile
    : EXTERNAL_GIFT_WRAPPING_ASSETS.desktop;
  return [
    {
      id: `gift-wrapping:${asset.assetId}`,
      prepare: () => {
        prepareAnchoredSceneData(data, placement, composerClass, false, true);
      },
    },
  ];
};

/** Case ids of the cat-borrow benchmark, in the order the story reports them. */
export const CAT_BORROW_BENCHMARK_CASE_IDS: readonly string[] = [
  CatAsset.Spike,
  CatAsset.Full,
].map((asset) => `cat-borrow:${CAT_BORROW_ASSET_IDS[asset]}`);

/**
 * The whole cat-borrow preparation, cloning included, for the spike clip and
 * the shipped full asset on the real composer with both buttons borrowable.
 */
export const catBorrowBenchmarkCases = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): PreparationBenchmarkCase[] => {
  const placement = catBorrowLayoutPlacement(isMobile);
  return [catBorrowSpike, catBorrowFull].map((data, index) => ({
    id: CAT_BORROW_BENCHMARK_CASE_IDS[index],
    prepare: () => {
      prepareCatBorrowScene(data, placement, anchors);
    },
  }));
};
