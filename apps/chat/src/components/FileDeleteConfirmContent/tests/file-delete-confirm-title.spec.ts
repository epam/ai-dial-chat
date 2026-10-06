import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { getFileDeleteConfirmTitle } from '../file-delete-confirm-title';

/* Echoes the key, so each case asserts which title was chosen. */
const t = ((key: string) => key) as unknown as TFunction;

const makeItem = (nodeType: DialFileNodeType): DialFile =>
  ({ id: 'id', name: 'name', path: '/name', nodeType }) as DialFile;

describe('getFileDeleteConfirmTitle', () => {
  it('titles a single folder "Delete folder"', () => {
    expect(
      getFileDeleteConfirmTitle(t, [makeItem(DialFileNodeType.FOLDER)]),
    ).toBe('dialFileManager.deleteConfirmTitleFolder');
  });

  it('titles a single file "Delete file"', () => {
    expect(
      getFileDeleteConfirmTitle(t, [makeItem(DialFileNodeType.ITEM)]),
    ).toBe('dialFileManager.deleteConfirmTitleFile');
  });

  it('titles a selection of several items "Delete items"', () => {
    expect(
      getFileDeleteConfirmTitle(t, [
        makeItem(DialFileNodeType.ITEM),
        makeItem(DialFileNodeType.FOLDER),
      ]),
    ).toBe('dialFileManager.deleteConfirmTitleMultiple');
  });
});
