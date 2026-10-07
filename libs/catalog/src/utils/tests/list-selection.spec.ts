import { describe, expect, it } from 'vitest';
import { toggleAllSelectedIds, toggleSelectedId } from '../list-selection';

describe('toggleSelectedId', () => {
  it('appends a newly selected id after the existing ones', () => {
    expect([...toggleSelectedId(new Set(['a', 'b']), 'c')]).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('removes a selected id and keeps the rest in order', () => {
    expect([...toggleSelectedId(new Set(['a', 'b', 'c']), 'a')]).toEqual([
      'b',
      'c',
    ]);
  });

  it('does not mutate the given selection', () => {
    const selected = new Set(['a']);
    toggleSelectedId(selected, 'b');
    expect([...selected]).toEqual(['a']);
  });
});

describe('toggleAllSelectedIds', () => {
  it('appends the missing listed ids in list order and keeps unlisted ones', () => {
    expect([
      ...toggleAllSelectedIds(new Set(['z', 'b']), ['a', 'b', 'c']),
    ]).toEqual(['z', 'b', 'a', 'c']);
  });

  it('clears only the listed ids when all of them are selected', () => {
    expect([
      ...toggleAllSelectedIds(new Set(['z', 'a', 'b']), ['a', 'b']),
    ]).toEqual(['z']);
  });

  it('leaves the selection alone when nothing is listed', () => {
    expect([...toggleAllSelectedIds(new Set(['z']), [])]).toEqual(['z']);
  });
});
