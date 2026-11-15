import type { MouseEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { isModifiedClick } from '../click';

const makeClick = (init: Partial<MouseEvent> = {}): MouseEvent =>
  ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  }) as MouseEvent;

describe('isModifiedClick', () => {
  it('returns false for a plain primary-button click', () => {
    expect(isModifiedClick(makeClick())).toBe(false);
  });

  it.each([
    ['Meta', { metaKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('returns true when %s is held', (_name, init) => {
    expect(isModifiedClick(makeClick(init))).toBe(true);
  });

  it.each([1, 2])('returns true for pointer button %i', (button) => {
    expect(isModifiedClick(makeClick({ button }))).toBe(true);
  });
});
