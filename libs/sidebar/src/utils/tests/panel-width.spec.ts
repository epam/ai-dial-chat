import { describe, expect, it } from 'vitest';
import { resolvePanelWidth } from '../panel-width';

describe('bounded panel width', () => {
  it.each([768, 1024, 1279])('leaves content visible at %spx', (viewport) => {
    expect(resolvePanelWidth(1800, 1500, 2000, viewport)).toEqual({
      width: viewport - 32,
      minWidth: viewport - 32,
      maxWidth: viewport - 32,
    });
  });

  it('retains the preferred panel size when it fits', () => {
    expect(resolvePanelWidth(360, 280, 600, 768).width).toBe(360);
  });

  it('caps contradictory minimum and maximum constraints', () => {
    expect(resolvePanelWidth(600, 600, 400, 768)).toEqual({
      width: 400,
      minWidth: 400,
      maxWidth: 400,
    });
  });

  it('supports narrow embedding containers and zero available space', () => {
    expect(resolvePanelWidth(600, 400, 1500, 320).width).toBe(288);
    expect(resolvePanelWidth(600, 400, 1500, 0).width).toBe(0);
  });
});
