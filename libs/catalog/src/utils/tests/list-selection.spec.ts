import { describe, expect, it } from 'vitest';
import { mergeGridSelection } from '../list-selection';

const merge = (previous: string[], grid: string[], listed: string[]) => [
  ...mergeGridSelection(new Set(previous), new Set(grid), listed),
];

describe('mergeGridSelection', () => {
  it('appends a newly selected id after the existing ones', () => {
    expect(merge(['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('appends an earlier row selected later, keeping selection order', () => {
    expect(merge(['c'], ['a', 'c'], ['a', 'b', 'c'])).toEqual(['c', 'a']);
  });

  it('removes a deselected id and keeps the rest in order', () => {
    expect(merge(['a', 'b', 'c'], ['b', 'c'], ['a', 'b', 'c'])).toEqual([
      'b',
      'c',
    ]);
  });

  it('keeps a hidden selection when every listed row is selected', () => {
    expect(merge(['z', 'a'], ['a', 'b'], ['a', 'b'])).toEqual(['z', 'a', 'b']);
  });

  it('clears only the listed ids when the grid reports none selected', () => {
    expect(merge(['z', 'a', 'b'], [], ['a', 'b'])).toEqual(['z']);
  });

  it('leaves the selection alone when nothing is listed', () => {
    expect(merge(['z'], [], [])).toEqual(['z']);
  });

  it('does not mutate the given selection', () => {
    const previous = new Set(['a']);
    mergeGridSelection(previous, new Set(['a', 'b']), ['a', 'b']);
    expect([...previous]).toEqual(['a']);
  });
});
