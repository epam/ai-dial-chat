/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import {
  getEmptyLeafFolderIds,
  getFolderNestingLevel,
  getFoldersDepth,
  getPartialAndFullyChosenFolders,
  getSelectedEntitiesByFolderId,
  remapMovedPath,
  updateMovedEntityId,
  updateMovedFolderId,
} from '@/src/utils/app/folders';

import {
  MAX_NESTED_FOLDERS,
  MAX_NEW_FOLDER_PATH_SEGMENTS,
} from '@/src/constants/folders';

import { FeatureType } from '@epam/ai-dial-shared';
import type { FolderInterface, ShareEntity } from '@epam/ai-dial-shared';

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
      oldParentFolderId: any,
      newParentFolderId: any,
      currentId: any,
      expectedFolderId: any,
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
      oldParentFolderId: any,
      newParentFolderId: any,
      currentId: any,
      expectedFolderId: any,
    ) => {
      expect(
        updateMovedEntityId(oldParentFolderId, newParentFolderId, currentId),
      ).toBe(expectedFolderId);
    },
  );
});

const testFolder = (
  id: string,
  folderId: string,
  overrides: Partial<FolderInterface> = {},
): FolderInterface => ({
  id,
  name: id.split('/').pop() ?? id,
  folderId,
  type: FeatureType.File,
  ...overrides,
});

const testFile = (id: string, folderId: string): ShareEntity => ({
  id,
  name: id.split('/').pop() ?? id,
  folderId,
});

describe('getEmptyLeafFolderIds', () => {
  it('returns ids of folders that have no child folders and no files', () => {
    const folders: FolderInterface[] = [
      testFolder('bucket/files/parent', 'bucket/files'),
      testFolder('bucket/files/parent/empty-leaf', 'bucket/files/parent'),
    ];
    const entities: ShareEntity[] = [];

    expect(getEmptyLeafFolderIds(folders, entities)).toEqual([
      'bucket/files/parent/empty-leaf',
    ]);
  });

  it('excludes folders that contain a child folder', () => {
    const folders: FolderInterface[] = [
      testFolder('bucket/files/parent', 'bucket/files'),
      testFolder('bucket/files/parent/child', 'bucket/files/parent'),
    ];
    expect(getEmptyLeafFolderIds(folders, [])).toEqual([
      'bucket/files/parent/child',
    ]);
  });

  it('excludes folders that contain a file', () => {
    const folders: FolderInterface[] = [
      testFolder('bucket/files/parent', 'bucket/files'),
    ];
    const entities: ShareEntity[] = [
      testFile('bucket/files/parent/doc.txt', 'bucket/files/parent'),
    ];
    expect(getEmptyLeafFolderIds(folders, entities)).toEqual([]);
  });
});

describe('getSelectedEntitiesByFolderId', () => {
  const entities: ShareEntity[] = [
    testFile('bucket/files/f1/a.txt', 'bucket/files/f1'),
    testFile('bucket/files/f1/b.txt', 'bucket/files/f1'),
    testFile('bucket/files/f2/c.txt', 'bucket/files/f2'),
  ];

  it('delegates to the same selection rules as getChildEntityIdsForChosenFolderUpdate', () => {
    expect(
      getSelectedEntitiesByFolderId({
        entities,
        folderId: 'bucket/files/f1',
        partialChosenFolderIds: ['bucket/files/f1'],
        chosenItemsIds: ['bucket/files/f1/a.txt'],
      }),
    ).toEqual(['bucket/files/f1/b.txt']);
  });

  it('returns every entity under folder when folder is not partially chosen', () => {
    expect(
      getSelectedEntitiesByFolderId({
        entities,
        folderId: 'bucket/files/f1',
        partialChosenFolderIds: [],
        chosenItemsIds: [],
      }),
    ).toEqual(['bucket/files/f1/a.txt', 'bucket/files/f1/b.txt']);
  });
});

describe('getSelectedEntitiesByFolderId', () => {
  const files = [
    { id: 'bucket/files/f1/a.txt' },
    { id: 'bucket/files/f1/b.txt' },
    { id: 'bucket/files/f2/c.txt' },
  ];

  it('returns all ids under folder when folder is not partially chosen', () => {
    expect(
      getSelectedEntitiesByFolderId({
        entities: files as ShareEntity[],
        folderId: 'bucket/files/f1',
        partialChosenFolderIds: [],
        chosenItemsIds: [],
      }),
    ).toEqual(['bucket/files/f1/a.txt', 'bucket/files/f1/b.txt']);
  });

  it('returns only unchosen ids under folder when folder is in partialChosenFolderIds', () => {
    expect(
      getSelectedEntitiesByFolderId({
        entities: files as ShareEntity[],
        folderId: 'bucket/files/f1',
        partialChosenFolderIds: ['bucket/files/f1'],
        chosenItemsIds: ['bucket/files/f1/a.txt'],
      }),
    ).toEqual(['bucket/files/f1/b.txt']);
  });

  it('excludes entities not under folderId path prefix', () => {
    expect(
      getSelectedEntitiesByFolderId({
        entities: files as ShareEntity[],
        folderId: 'bucket/files/f2',
        partialChosenFolderIds: [],
        chosenItemsIds: [],
      }),
    ).toEqual(['bucket/files/f2/c.txt']);
  });

  it('does not match files from folders whose names share a prefix', () => {
    const filesWithSimilarFolders = [
      { id: 'bucket/files/folder01/file1.txt' },
      { id: 'bucket/files/folder0101/file2.txt' },
    ];
    expect(
      getSelectedEntitiesByFolderId({
        entities: filesWithSimilarFolders as ShareEntity[],
        folderId: 'bucket/files/folder01',
        partialChosenFolderIds: [],
        chosenItemsIds: [],
      }),
    ).toEqual(['bucket/files/folder01/file1.txt']);
  });
});

describe('getPartialAndFullyChosenFolders with directContainerFolderIds', () => {
  const nestedItems = [
    { id: 'files/public/folderX/sub/a.png' },
    { id: 'files/public/folderX/sub/b.png' },
  ] as ShareEntity[];
  const nestedFolders = [
    { id: 'files/public/folderX' },
    { id: 'files/public/folderX/sub' },
  ] as FolderInterface[];
  // only the folder that directly holds files
  const directContainerFolderIds = ['files/public/folderX/sub'];

  it('marks an ancestor folder fully chosen when all nested items are selected', () => {
    const { fullyChosenFolderIds, partialChosenFolderIds } =
      getPartialAndFullyChosenFolders(
        nestedFolders,
        nestedItems,
        nestedItems.map((i) => i.id),
        undefined,
        undefined,
        directContainerFolderIds,
      );

    expect(fullyChosenFolderIds).toContain('files/public/folderX/');
    expect(fullyChosenFolderIds).toContain('files/public/folderX/sub/');
    expect(partialChosenFolderIds).toEqual([]);
  });

  it('keeps the ancestor folder partial when not all nested items are selected', () => {
    const { fullyChosenFolderIds, partialChosenFolderIds } =
      getPartialAndFullyChosenFolders(
        nestedFolders,
        nestedItems,
        ['files/public/folderX/sub/a.png'],
        undefined,
        undefined,
        directContainerFolderIds,
      );

    expect(fullyChosenFolderIds).toEqual([]);
    expect(partialChosenFolderIds).toContain('files/public/folderX/');
    expect(partialChosenFolderIds).toContain('files/public/folderX/sub/');
  });
});

describe('getPartialAndFullyChosenFolders with folder/prompt id collision', () => {
  // A folder and a root-level prompt share the exact same path string
  // (the prompt is named identically to the folder). The prompt id equals
  // the folder id without a trailing slash.
  const folderPath = 'prompts/bucket/collide';
  const folders = [{ id: folderPath }] as FolderInterface[];
  const items = [
    { id: folderPath }, // root prompt named exactly like the folder
    { id: `${folderPath}/child-a` },
    { id: `${folderPath}/child-b` },
  ] as ShareEntity[];

  it('keeps the folder partial when one child is unselected despite the id collision', () => {
    const { fullyChosenFolderIds, partialChosenFolderIds } =
      getPartialAndFullyChosenFolders(folders, items, [
        folderPath,
        `${folderPath}/child-a`,
        // child-b intentionally left unselected
      ]);

    expect(fullyChosenFolderIds).not.toContain(`${folderPath}/`);
    expect(partialChosenFolderIds).toContain(`${folderPath}/`);
  });

  it('marks the folder fully chosen when all its children are selected', () => {
    const { fullyChosenFolderIds } = getPartialAndFullyChosenFolders(
      folders,
      items,
      items.map((i) => i.id),
    );

    expect(fullyChosenFolderIds).toContain(`${folderPath}/`);
  });
});

describe('getFolderNestingLevel', () => {
  it.each([
    [undefined, 0],
    ['', 0],
    ['files/bucket', 0],
    ['files/bucket/folder1', 1],
    ['files/bucket/folder1/folder2', 2],
    ['files/bucket/folder1/folder2/folder3', 3],
    ['files/bucket/folder1/folder2/folder3/folder4', 4],
  ])('returns %s -> %s', (folderId, expected) => {
    expect(getFolderNestingLevel(folderId)).toBe(expected);
  });

  it('ignores a trailing slash', () => {
    expect(getFolderNestingLevel('files/bucket/folder1/')).toBe(1);
  });

  it.each([
    ['files/bucket', true],
    ['files/bucket/f1', true],
    ['files/bucket/f1/f2', true],
    ['files/bucket/f1/f2/f3', true],
    ['files/bucket/f1/f2/f3/f4', false],
  ])('allows creating inside %s -> %s', (parentId, allowed) => {
    expect(getFolderNestingLevel(parentId) < MAX_NESTED_FOLDERS).toBe(allowed);
  });
});

describe('getFoldersDepth', () => {
  const bucket = 'files/bucket';
  const folders = [
    testFolder(`${bucket}/src`, bucket),
    testFolder(`${bucket}/src/child`, `${bucket}/src`),
    testFolder(`${bucket}/leaf`, bucket),
  ];

  it('counts the folder itself, so a leaf is 1', () => {
    expect(getFoldersDepth(folders[2], folders)).toBe(1);
  });

  it('counts the deepest nested child', () => {
    expect(getFoldersDepth(folders[0], folders)).toBe(2);
  });
});

describe('remapMovedPath', () => {
  const bucket = 'files/bucket';
  const rename = [
    { sourceUrl: `${bucket}/parent`, destinationUrl: `${bucket}/renamed` },
  ];

  it('remaps the moved folder itself', () => {
    expect(remapMovedPath(`${bucket}/parent`, rename)).toBe(
      `${bucket}/renamed`,
    );
  });

  it('keeps the subtree below the moved folder', () => {
    expect(remapMovedPath(`${bucket}/parent/child/leaf`, rename)).toBe(
      `${bucket}/renamed/child/leaf`,
    );
  });

  it('leaves unrelated paths untouched', () => {
    expect(remapMovedPath(`${bucket}/other/child`, rename)).toBe(
      `${bucket}/other/child`,
    );
  });

  it('does not match a sibling sharing the name prefix', () => {
    expect(remapMovedPath(`${bucket}/parent2/child`, rename)).toBe(
      `${bucket}/parent2/child`,
    );
  });

  it('remaps a path moved to another parent', () => {
    expect(
      remapMovedPath(`${bucket}/a/moved/child`, [
        {
          sourceUrl: `${bucket}/a/moved`,
          destinationUrl: `${bucket}/b/moved`,
        },
      ]),
    ).toBe(`${bucket}/b/moved/child`);
  });

  it('applies a single mapping per path, so a chain does not remap twice', () => {
    expect(
      remapMovedPath(`${bucket}/a`, [
        { sourceUrl: `${bucket}/a`, destinationUrl: `${bucket}/b` },
        { sourceUrl: `${bucket}/b`, destinationUrl: `${bucket}/c` },
      ]),
    ).toBe(`${bucket}/b`);
  });
});

describe('MAX_NEW_FOLDER_PATH_SEGMENTS', () => {
  it.each([
    'files/bucket',
    'files/bucket/f1',
    'files/bucket/f1/f2',
    'files/bucket/f1/f2/f3',
    'files/bucket/f1/f2/f3/f4',
  ])('matches the app-side check for %s', (parentId) => {
    const vetoedByUiKit =
      parentId.split('/').filter(Boolean).length >
      MAX_NEW_FOLDER_PATH_SEGMENTS - 1;

    expect(vetoedByUiKit).toBe(
      getFolderNestingLevel(parentId) >= MAX_NESTED_FOLDERS,
    );
  });
});
