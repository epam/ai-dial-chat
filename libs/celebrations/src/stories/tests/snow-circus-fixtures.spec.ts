import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = 'ab5df71a0fbf1225fe375392069a158fdc6a00b1e3181199999b200ef821ca2c';

describe('maintained Themes Snow Circus sources', () => {
  it.each(['desktop', 'mobile'])(
    'pins the %s source and enforces the scene budgets',
    (variant) => {
      const bytes = readFileSync(
        join(
          import.meta.dirname,
          `../fixtures/snow-circus.${variant}.lottie.json`,
        ),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(HASH);
      expect(bytes.byteLength).toBeLessThanOrEqual(512 * 1024);
      const data = JSON.parse(bytes.toString());
      expect(data.layers.length).toBeLessThanOrEqual(48);
      expect((data.op - data.ip) / data.fr).toBe(26);
      let keys = 0;
      let paths = 0;
      let vertices = 0;
      const visit = (value: unknown) => {
        if (typeof value !== 'object' || value == null) return;
        const item = value as Record<string, unknown>;
        if (item.a === 1 && Array.isArray(item.k)) keys += item.k.length;
        if (['sh', 'el', 'rc'].includes(String(item.ty))) paths++;
        if (Array.isArray(item.v) && Array.isArray(item.i))
          vertices += item.v.length;
        expect(item.ef).toBeUndefined();
        expect(item.masksProperties).toBeUndefined();
        expect(item.tt).toBeUndefined();
        Object.values(item).forEach(visit);
      };
      visit(data);
      expect(keys).toBeLessThanOrEqual(2500);
      expect(paths).toBeLessThanOrEqual(160);
      expect(vertices).toBeLessThanOrEqual(1000);
    },
  );

  it('pins the reduced-motion composition without script or external resources', () => {
    const bytes = readFileSync(
      join(import.meta.dirname, '../fixtures/snow-circus.poster.svg'),
    );
    expect(bytes.byteLength).toBeLessThanOrEqual(30 * 1024);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'fc8fb7b6c7f0b5784557c27d5781938650a798b6b78115d4a8d59e6a53d0ece6',
    );
    expect(bytes.toString()).not.toMatch(
      /<script|<image|<foreignObject|\bon\w+=|href=/i,
    );
  });
});
