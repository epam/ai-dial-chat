import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTERNAL_GIFT_WRAPPING_ASSETS } from '../../test-utils/external-gift-wrapping';
import { SANTA_HISTORY_ASSETS } from '../../test-utils/santa-history-delivery';
import { SANTA_HISTORY_FULL_ASSETS } from '../../test-utils/santa-history-full';
import { readHistoryLadderMetadata } from '../../utils/history-ladder-contract';
import { createStoryPackLoaders } from '../pack-story-loaders';

const readFixture = (file: string) =>
  readFileSync(join(import.meta.dirname, '../fixtures/external', file));

describe('pinned external GiftWrapping fixtures', () => {
  it.each(Object.entries(EXTERNAL_GIFT_WRAPPING_ASSETS))(
    'keeps the published %s asset byte for byte',
    (_variant, asset) => {
      const bytes = readFixture(asset.file);

      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        asset.sha256,
      );
      expect(asset.assetId.endsWith(asset.sha256.slice(0, 16))).toBe(true);
    },
  );
});

describe('unpublished Santa history delivery sources', () => {
  it.each(Object.values(SANTA_HISTORY_FULL_ASSETS))(
    'keeps $assetId flight outside the entry/exit edges and its rider synchronized',
    (asset) => {
      const data = JSON.parse(readFixture(asset.file).toString());
      const metadata = readHistoryLadderMetadata(data);
      const flight = data.layers.find(
        (layer: { nm: string }) => layer.nm === 'hl-track:flight',
      );
      const actor = data.layers.find(
        (layer: { nm: string }) => layer.nm === 'hl-track:actor',
      );
      const keys = flight.ks.p.k;
      expect(metadata.useStartEdge).toBe(true);
      expect(
        keys[0].s[0] + (metadata.flightBounds?.right ?? Infinity),
      ).toBeLessThan(0);
      expect(
        keys.at(-1).s[0] + (metadata.flightBounds?.left ?? -Infinity),
      ).toBeGreaterThan(data.w);
      const departure = 23.8 * data.fr;
      expect(
        actor.ks.p.k.filter(({ t }: { t: number }) => t >= departure),
      ).toEqual(keys.filter(({ t }: { t: number }) => t >= departure));
      const arrival = keys.find(({ t }: { t: number }) => t === 19.2 * data.fr);
      expect(arrival.i.y).toEqual([1]);
      expect(keys.find(({ t }: { t: number }) => t === departure).o.y).toEqual([
        0,
      ]);
      for (const layer of data.layers.filter(
        ({ parent }: { parent?: number }) => parent === flight.ind,
      )) {
        for (const group of layer.shapes) {
          const transform = group.it.find(
            ({ ty }: { ty: string }) => ty === 'tr',
          );
          expect(transform.s.a).toBe(0);
          expect(transform.o).toEqual({ a: 0, k: 100 });
        }
      }
    },
  );

  it.each(Object.values(SANTA_HISTORY_FULL_ASSETS))(
    'serves the pinned full-story fixture for $assetId',
    async (asset) => {
      const data = await createStoryPackLoaders().loadAnimationData(
        asset.assetId,
        new AbortController().signal,
      );

      expect(data).toEqual(JSON.parse(readFixture(asset.file).toString()));
    },
  );

  it.each([
    ...Object.entries(SANTA_HISTORY_ASSETS),
    ...Object.entries(SANTA_HISTORY_FULL_ASSETS),
  ])(
    'pins authored %s bytes and validates its declared native contract',
    (_variant, asset) => {
      const bytes = readFixture(asset.file);
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        asset.sha256,
      );
      expect(asset.file).toContain(asset.sha256.slice(0, 16));
      if (asset.file.endsWith('.json')) {
        const data = JSON.parse(bytes.toString());
        expect(() => readHistoryLadderMetadata(data)).not.toThrow();
        expect((data.op - data.ip) / data.fr).toBe(
          asset.file.includes('.full.') ? 27 : 12,
        );
        expect(bytes.byteLength).toBeLessThanOrEqual(300 * 1024);
      }
    },
  );
});
