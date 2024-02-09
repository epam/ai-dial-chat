import { FolderType } from '@/src/types/folder';

import {
  getFolderIdByPath,
  updateMovedEntityId,
  updateMovedFolderId,
} from '../folders';

describe('Folder utility methods', () => {
  it.each([
    ['f1', '1'],
    ['f1/f2', '2'],
    ['f1/f2/f3/f4/f5', '5'],
    ['f1/f2/f3/f4/f5/f6', undefined],
    ['f1/f2/f33/f4', undefined],
    ['f1/f2/f4', undefined],
  ])('getFolderIdByPath (%s, %s)', (path, expectedFolderId) => {
    const folders = [
      { name: 'f1', type: FolderType.Prompt, id: '1', folderId: undefined },
      { name: 'f2', type: FolderType.Prompt, id: '2', folderId: '1' },
      { name: 'f3', type: FolderType.Prompt, id: '3', folderId: '2' },
      { name: 'f4', type: FolderType.Prompt, id: '4', folderId: '3' },
      { name: 'f5', type: FolderType.Prompt, id: '5', folderId: '4' },
    ];
    expect(getFolderIdByPath(path, folders)).toBe(expectedFolderId);
  });

  it.each([
    [undefined, 'f1', undefined, 'f1'],
    ['f1', 'f2', 'f1', 'f2'],
    ['f1', undefined, 'f1', undefined],
    ['f1', undefined, 'f1/f2', 'f2'],
    ['f1', undefined, 'f1/f1/f1', 'f1/f1'],
    [undefined, undefined, 'f1/f1/f1', 'f1/f1/f1'],
    [undefined, 'f3', 'f1/f1/f1', 'f1/f1/f1'],
    ['f2', undefined, 'f1/f1/f1', 'f1/f1/f1'],
    ['f2', 'f3', 'f1/f1/f1', 'f1/f1/f1'],
  ])(
    'updateMovedFolderId (%s, %s, %s, %s)',
    (
      oldParentFolderId: string | undefined,
      newParentFolderId: string | undefined,
      currentId: string | undefined,
      expectedFolderId: string | undefined,
    ) => {
      expect(
        updateMovedFolderId(oldParentFolderId, newParentFolderId, currentId),
      ).toBe(expectedFolderId);
    },
  );

  it.each([
    ['f1', 'f2', 'f1', 'f1'],
    ['f1', 'f2', 'f1/f1', 'f2/f1'],
    ['f1/f1', 'f2', 'f1/f1/f1', 'f2/f1'],
    ['f1', undefined, 'f1', 'f1'],
    ['f1', undefined, 'f1/f2', 'f2'],
    ['f1', undefined, 'f1/f1/f1', 'f1/f1'],
    [undefined, undefined, 'f1/f1/f1', 'f1/f1/f1'],
    [undefined, 'f3', 'f1/f1/f1', 'f1/f1/f1'],
    ['f2', undefined, 'f1/f1/f1', 'f1/f1/f1'],
    ['f2', 'f3', 'f1/f1/f1', 'f1/f1/f1'],
  ])(
    'updateMovedEntityId (%s, %s, %s, %s)',
    (
      oldParentFolderId: string | undefined,
      newParentFolderId: string | undefined,
      currentId: string,
      expectedFolderId: string,
    ) => {
      expect(
        updateMovedEntityId(oldParentFolderId, newParentFolderId, currentId),
      ).toBe(expectedFolderId);
    },
  );
});
