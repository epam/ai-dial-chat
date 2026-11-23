import { describe, expect, it, vi } from 'vitest';
import { normalizeFileManagerTabs } from '../file-manager-tabs.normalizer';

const EVERY_TAB = ['all', 'my_files', 'shared', 'organization'];

describe('normalizeFileManagerTabs', () => {
  it('emits the fixed tab order whatever order the value lists', () => {
    const warn = vi.fn();
    expect(
      normalizeFileManagerTabs(
        ['organization', 'shared', 'my_files', 'all'],
        warn,
      ),
    ).toEqual(EVERY_TAB);
    expect(
      normalizeFileManagerTabs(['organization', 'my_files'], warn),
    ).toEqual(['my_files', 'organization']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops All below two source tabs, as the client would hide it', () => {
    expect(normalizeFileManagerTabs(['all', 'organization'], vi.fn())).toEqual([
      'organization',
    ]);
  });

  it('keeps a single source tab without All', () => {
    expect(normalizeFileManagerTabs(['shared'], vi.fn())).toEqual(['shared']);
  });

  /* Only All would leave File Manager and the attach picker without a section. */
  it.each([
    ['only all', ['all']],
    ['only unknown ids', ['review', 1, null]],
  ])('falls back to every tab and warns for %s', (_label, value) => {
    const warn = vi.fn();
    expect(normalizeFileManagerTabs(value, warn)).toEqual(EVERY_TAB);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('lists no source tab'),
    );
  });

  it.each([
    ['a non-array', 'x'],
    ['null', null],
    ['an empty list', []],
  ])('falls back to every tab silently for %s', (_label, value) => {
    const warn = vi.fn();
    expect(normalizeFileManagerTabs(value, warn)).toEqual(EVERY_TAB);
    expect(warn).not.toHaveBeenCalled();
  });

  it('collapses repeated ids', () => {
    expect(
      normalizeFileManagerTabs(['my_files', 'my_files', 'shared'], vi.fn()),
    ).toEqual(['my_files', 'shared']);
  });

  it('returns a fresh array each time', () => {
    const value = ['my_files', 'shared'];
    const first = normalizeFileManagerTabs(value, vi.fn());
    expect(first).not.toBe(value);
    expect(normalizeFileManagerTabs(value, vi.fn())).not.toBe(first);
  });
});
