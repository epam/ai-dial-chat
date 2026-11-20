import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAT_BORROW_ANCHOR_PREFIX,
  CAT_BORROW_MARKERS,
} from '../../constants/cat-borrow';
import type {
  LottieComposition,
  LottieLayer,
} from '../../models/lottie-composition';
import full from '../../stories/fixtures/cat-borrow-full.lottie.json';
import spike from '../../stories/fixtures/cat-borrow-spike.lottie.json';
import { CatBorrowSlot } from '../../types/cat-borrow';
import { bindStationKeyframes } from '../lottie-anchor-binding';
import { readNamespacedMarkers } from '../lottie-markers';

/* sha256 of `cat.eaf1803ee95992a9.json` in the themes pack halloween-default@1.0.0. */
const PUBLISHED_FULL_SHA256 =
  'eaf1803ee95992a9a740b4606521b7aa69d0d5c2ee85ad859a2ad2e8474d4a5e';

describe('cat-borrow-full fixture', () => {
  it('is byte-identical to the published halloween-default@1.0.0 asset', () => {
    const bytes = readFileSync(
      join(
        import.meta.dirname,
        '../../stories/fixtures/cat-borrow-full.lottie.json',
      ),
    );

    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      PUBLISHED_FULL_SHA256,
    );
  });
});

type Asset = LottieComposition & {
  assets: { id: string; layers: LottieLayer[] }[];
  fr: number;
  ddd: number;
};

const walk = (
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
) => {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (value && typeof value === 'object') {
    visit(value as Record<string, unknown>);
    Object.values(value).forEach((item) => walk(item, visit));
  }
};

const count = (
  value: unknown,
  pick: (node: Record<string, unknown>) => number,
) => {
  let total = 0;
  walk(value, (node) => {
    total += pick(node);
  });
  return total;
};

describe.each([
  ['spike', spike, ['one-prize']],
  ['full', full, ['two-prizes', 'one-prize', 'crossing']],
])('cat-borrow %s fixture', (_name, json, sections) => {
  const data = json as unknown as Asset;
  const rigLayers = data.assets[0].layers;
  const rigEnd = Math.max(...rigLayers.map(({ op }) => op ?? 0));
  const scopes = () =>
    readNamespacedMarkers(data, CAT_BORROW_MARKERS, { from: 0, to: rigEnd });

  it('stays inside the lottie-light-svg-v1 subset', () => {
    expect(data.ddd).toBe(0);
    expect(data.fr).toBeGreaterThanOrEqual(24);
    expect(data.fr).toBeLessThanOrEqual(60);
    expect(
      [...data.layers, ...rigLayers].every(({ ty }) => [0, 3, 4].includes(ty)),
    ).toBe(true);
    walk(data, (node) => {
      expect(typeof node.x === 'string', 'expression').toBe(false);
      expect('ef' in node, 'effect').toBe(false);
    });
    expect(JSON.stringify(data)).not.toMatch(/data:|"fonts"|"chars"|"u":/);
  });

  it('stays within the structure caps', () => {
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(512 * 1024);
    expect(data.layers.length + rigLayers.length).toBeLessThanOrEqual(30);
    expect(
      count(data, (node) =>
        node.a === 1 && Array.isArray(node.k) ? node.k.length : 0,
      ),
    ).toBeLessThanOrEqual(4000);
    expect(
      count(data, (node) =>
        node.ty === 'sh' ? (node.ks as { k: { v: unknown[] } }).k.v.length : 0,
      ),
    ).toBeLessThanOrEqual(8000);
  });

  it('declares its sections with valid cat markers', () => {
    expect(scopes().map(({ marker }) => marker?.argument)).toEqual(sections);
  });

  it('binds every station keyframe and leaves it in place at reference geometry', () => {
    const bindings = scopes()
      .flatMap(({ markers }) => markers)
      .filter(({ kind }) => kind === 'bind');
    const anchors = Object.fromEntries(
      [...new Set(bindings.map(({ argument }) => argument ?? ''))].map(
        (name) => {
          const [x, y] = rigLayers.find(
            (layer) => layer.nm === `${CAT_BORROW_ANCHOR_PREFIX}${name}`,
          )?.ks?.p?.k as number[];
          return [name, { point: { x, y }, side: 1 as const }];
        },
      ),
    );
    const positions = (list: LottieLayer[]) =>
      (
        list.find(({ nm }) => nm === CatBorrowSlot.Root)?.ks?.p?.k as {
          s: number[];
        }[]
      ).map(({ s }) => s.map((value) => Number(value.toFixed(6))));

    expect(
      positions(
        bindStationKeyframes(rigLayers, {
          positionLayer: CatBorrowSlot.Root,
          facingLayer: CatBorrowSlot.Facing,
          referencePrefix: CAT_BORROW_ANCHOR_PREFIX,
          bindings,
          anchors,
        }),
      ),
    ).toEqual(positions(rigLayers));
  });
});
