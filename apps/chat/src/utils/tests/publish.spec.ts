import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { BasicI18nKeys } from '../../constants/translation-keys';
import { getPublishFolderLabel } from '../publish';

const t = ((key: string) => key) as unknown as TFunction;

describe('getPublishFolderLabel', () => {
  it('names the leaf segment of a nested folder path', () => {
    expect(getPublishFolderLabel(['Organization', 'Data Science'], t)).toBe(
      'Data Science',
    );
  });

  it('names the leaf segment of a joined folder path', () => {
    expect(getPublishFolderLabel('Organization/Data Science', t)).toBe(
      'Data Science',
    );
  });

  /*
   * The Organization root has no path segments, so its leaf is the empty
   * string — GH #8704, where the confirmation read `folder ""`.
   */
  it('falls back to the root label for the segment-less public root', () => {
    expect(getPublishFolderLabel([], t)).toBe(BasicI18nKeys.Organization);
  });

  it('falls back to the root label for an empty joined path', () => {
    expect(getPublishFolderLabel('', t)).toBe(BasicI18nKeys.Organization);
  });
});
