import { describe, expect, it } from 'vitest';
import { isHiddenPath } from '../file-path';

describe('isHiddenPath', () => {
  it('returns true when any path segment starts with a dot', () => {
    expect(isHiddenPath('/My files/.env')).toBe(true);
    expect(isHiddenPath('/My files/.hidden/report.pdf')).toBe(true);
    expect(isHiddenPath('/My files/docs/.dial_folder')).toBe(true);
  });

  it('returns false for visible files with dots in their names', () => {
    expect(isHiddenPath('/My files/report.pdf')).toBe(false);
    expect(isHiddenPath('/My files/folder.with.dots/report.pdf')).toBe(false);
  });
});
