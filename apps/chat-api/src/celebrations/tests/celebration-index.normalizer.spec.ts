import { describe, expect, it, vi } from 'vitest';
import { normalizeCelebrationIndex } from '../celebration-index.normalizer';
import { readJsonFixture } from './celebrations.fixtures';

const fixtureIndex = () => readJsonFixture('index.json');

describe('normalizeCelebrationIndex', () => {
  it('returns the catalog without manifest paths, sizes or hashes', () => {
    const result = normalizeCelebrationIndex(fixtureIndex(), vi.fn());

    expect(result).toMatchObject({
      value: {
        catalog: {
          schemaVersion: 1,
          revision: '2026-11-15.1',
          packs: [
            {
              packId: 'new-year-default',
              version: '1.0.0',
              eventId: 'new-year',
            },
            {
              packId: 'company-anniversary',
              version: '1.0.0',
              eventId: 'company-anniversary',
            },
          ],
          defaults: {
            'new-year': { packId: 'new-year-default', version: '1.0.0' },
          },
        },
      },
    });
    const { catalog, packs } = (
      result as Extract<typeof result, { value: unknown }>
    ).value;
    expect(JSON.stringify(catalog)).not.toMatch(/manifest|sha256|bytes/);
    expect(packs[0].manifest.path).toBe('new-year-default/1.0.0/manifest.json');
  });

  it('strips unknown fields', () => {
    const index = fixtureIndex();
    const packs = index.packs as Record<string, unknown>[];
    packs[0].secret = 'x';
    const result = normalizeCelebrationIndex(
      { ...index, extra: true, packs },
      vi.fn(),
    );
    expect(JSON.stringify(result)).not.toMatch(/secret|extra/);
  });

  it('drops a default for an unlisted pack and keeps the rest of the index', () => {
    const warn = vi.fn();
    const result = normalizeCelebrationIndex(
      {
        ...fixtureIndex(),
        defaults: {
          'new-year': { packId: 'new-year-default', version: '9.9.9' },
          'company-anniversary': {
            packId: 'company-anniversary',
            version: '1.0.0',
          },
        },
      },
      warn,
    );
    expect(result).toMatchObject({
      value: {
        catalog: {
          defaults: {
            'company-anniversary': {
              packId: 'company-anniversary',
              version: '1.0.0',
            },
          },
        },
      },
    });
    expect(
      'value' in result && 'new-year' in result.value.catalog.defaults,
    ).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropping celebration default for new-year'),
    );
  });

  it('drops a default bound to a pack of another event', () => {
    const result = normalizeCelebrationIndex(
      {
        ...fixtureIndex(),
        defaults: {
          halloween: { packId: 'new-year-default', version: '1.0.0' },
        },
      },
      vi.fn(),
    );
    expect('value' in result && result.value.catalog.defaults).toEqual({});
  });

  it('rejects a pack version listed twice', () => {
    const index = fixtureIndex();
    const packs = index.packs as unknown[];
    expect(
      normalizeCelebrationIndex(
        { ...index, packs: [...packs, packs[0]] },
        vi.fn(),
      ),
    ).toEqual({ error: 'new-year-default@1.0.0 is listed twice' });
  });

  it.each([
    ['an invalid packId', { packId: 'New_Year' }],
    ['an invalid version', { version: '1.0' }],
    ['an invalid eventId', { eventId: '../new-year' }],
    ['a manifest without a hash', { manifest: { path: 'x', bytes: 10 } }],
  ])('rejects the whole index for %s', (_, override) => {
    const index = fixtureIndex();
    const packs = index.packs as Record<string, unknown>[];
    expect(
      normalizeCelebrationIndex(
        { ...index, packs: [{ ...packs[0], ...override }, packs[1]] },
        vi.fn(),
      ),
    ).toHaveProperty('error');
  });

  it.each([
    ['schemaVersion 2', { schemaVersion: 2 }],
    ['an invalid revision', { revision: 'not valid!' }],
    ['packs that is not a list', { packs: {} }],
  ])('rejects %s', (_, override) => {
    expect(
      normalizeCelebrationIndex({ ...fixtureIndex(), ...override }, vi.fn()),
    ).toHaveProperty('error');
  });
});
