import { updateMovedEntityId, updateMovedFolderId } from '../folders';

describe.skip('Folder utility methods', () => {
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
