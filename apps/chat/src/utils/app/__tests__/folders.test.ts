/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';

import {
  addGeneratedFolderId,
  canEditSharedFolderOrParent,
  generateNextName,
  getChildAndCurrentFoldersById,
  getFolderFromId,
  getFolderIdFromEntityId,
  getFoldersDepth,
  getGeneratedFolderId,
  getNextDefaultName,
  getParentAndCurrentFolderIdsById,
  getParentAndCurrentFoldersById,
  getParentFolderIdsFromFolderId,
  getPathToFolderById,
  getRootFolderIdFromEntityId,
  getSelectedEntitiesByFolderId,
  isFolderEmpty,
  isFolderPartialSelected,
  isParentFolderSelected,
  sortByName,
  updateChildAndCurrentFoldersIds,
  updateEntityFolder,
  updateMovedEntityId,
  updateMovedFolderId,
  validateFolderRenaming,
} from '@/src/utils/app/folders';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';

import * as commonUtils from '../common';

import { Entity, SharePermission } from '@epam/ai-dial-shared';

describe('Folder utility methods', () => {
  // Test data setup
  const createFolder = (
    name: string,
    folderId?: string,
    type: FeatureType = FeatureType.Chat,
  ): FolderInterface => ({
    id: `${folderId ? `${folderId}/` : ''}${name}`,
    name,
    folderId: folderId || '',
    type,
  });

  describe('getFoldersDepth', () => {
    it('should return 1 for a folder with no children', () => {
      const folder = createFolder('folder1', 'folder 2');
      const allFolders: FolderInterface[] = [folder];

      expect(getFoldersDepth(folder, allFolders)).toBe(1);
    });

    it('should calculate depth correctly for nested folders', () => {
      const folder1 = createFolder('folder 1', 'entity/bucket');
      const folder2 = createFolder('folder 2', 'entity/bucket/folder 1');
      const folder3 = createFolder(
        'folder 3',
        'entity/bucket/folder 1/folder 2',
      );
      const allFolders: FolderInterface[] = [folder1, folder2, folder3];

      expect(getFoldersDepth(folder1, allFolders)).toBe(3); // folder1 -> folder2 -> folder3
    });
  });

  describe('getParentAndCurrentFoldersById', () => {
    it('should return empty array for undefined folderId', () => {
      const folders: FolderInterface[] = [];
      expect(getParentAndCurrentFoldersById(folders, undefined)).toEqual([]);
    });

    it('should return current folder and its parents', () => {
      const folder1 = createFolder('folder 1', 'entity/bucket');
      const folder2 = createFolder('folder 2', 'entity/bucket/folder 1');
      const folder3 = createFolder(
        'folder 3',
        'entity/bucket/folder 1/folder 2',
      );
      const folders: FolderInterface[] = [folder1, folder2, folder3];

      expect(getParentAndCurrentFoldersById(folders, folder3.id)).toEqual([
        folder3,
        folder2,
        folder1,
      ]);
    });

    it('should handle circular references', () => {
      const folder1 = createFolder('folder 1', 'entity/bucket');
      const folder2 = createFolder('folder 2', 'entity/bucket/folder 1');
      const folder3 = createFolder(
        'folder 3',
        'entity/bucket/folder 1/folder 2',
      );
      const folders: FolderInterface[] = [folder1, folder2, folder3];

      expect(getParentAndCurrentFoldersById(folders, folder3.id)).toEqual([
        folder3,
        folder2,
        folder1,
      ]);
    });
  });

  describe('getParentAndCurrentFolderIdsById', () => {
    it('should return the folder ID and its parent IDs', () => {
      const folderId = 'api-key/bucket/parent/child/grandchild';
      const expected = [
        'api-key/bucket/parent/child/grandchild',
        'api-key/bucket/parent/child',
        'api-key/bucket/parent',
      ];

      expect(getParentAndCurrentFolderIdsById(folderId)).toEqual(expected);
    });
  });

  describe('getChildAndCurrentFoldersById', () => {
    it('should return empty array when folder ID is not found', () => {
      const allFolders: FolderInterface[] = [];
      expect(getChildAndCurrentFoldersById('nonexistent', allFolders)).toEqual(
        [],
      );
    });

    it('should return the folder and all its children', () => {
      const folder1 = createFolder('folder 1', 'entity/bucket');
      const folder2 = createFolder('folder 2', 'entity/bucket/folder 1');
      const folder3 = createFolder(
        'folder 3',
        'entity/bucket/folder 1/folder 2',
      );
      const allFolders: FolderInterface[] = [folder1, folder2, folder3];

      const result = getChildAndCurrentFoldersById(folder1.id, allFolders);

      expect(result).toHaveLength(3);
      expect(result).toContain(folder1);
      expect(result).toContain(folder2);
      expect(result).toContain(folder3);
    });
  });

  describe('getNextDefaultName', () => {
    it('should return defaultName + 1 when no entities exist', () => {
      const entities: Entity[] = [];
      expect(getNextDefaultName('Untitled', entities)).toBe('Untitled 1');
    });

    it('should return defaultName when startWithEmptyPostfix is true and no entities exist', () => {
      const entities: Entity[] = [];
      expect(getNextDefaultName('Untitled', entities, 0, true)).toBe(
        'Untitled',
      );
    });

    it('should find the next available number', () => {
      const entities: Entity[] = [
        {
          id: 'root/Untitled 1',
          name: 'Untitled 1',
          folderId: 'root',
        },
        {
          id: 'root/Untitled 2',
          name: 'Untitled 2',
          folderId: 'root',
        },
      ];

      expect(getNextDefaultName('Untitled', entities)).toBe('Untitled 3');
    });
  });

  describe('generateNextName', () => {
    it('should increment numbered name', () => {
      const entities: Entity[] = [
        { id: 'root/Folder 1', name: 'Folder 1', folderId: 'root' },
        { id: 'root/Folder 2', name: 'Folder 2', folderId: 'root' },
      ];

      expect(generateNextName('Folder', 'Folder 2', entities)).toBe('Folder 3');
    });

    it('should keep custom name format when not matching pattern', () => {
      const entities: Entity[] = [
        {
          id: 'root/My Custom Folder',
          name: 'My Custom Folder',
          folderId: 'root',
        },
      ];

      expect(generateNextName('Folder', 'My Custom Folder', entities)).toBe(
        'My Custom Folder 1',
      );
    });
  });

  describe('getPathToFolderById', () => {
    it('should return empty path for undefined folder ID', () => {
      const folders: FolderInterface[] = [];

      expect(getPathToFolderById(folders, undefined)).toEqual({
        path: '',
        pathDepth: -1,
      });
    });

    it('should construct path from folder ID', () => {
      const folder1 = createFolder('folder 1', 'entity/bucket');
      const folder2 = createFolder('folder 2', `entity/bucket/${folder1.name}`);
      const folders: FolderInterface[] = [folder1, folder2];

      expect(getPathToFolderById(folders, folder2.id)).toEqual({
        path: 'folder 1/folder 2',
        pathDepth: 1,
      });
    });

    it('should use prepared names if prepareNames option is true', () => {
      const folder = createFolder('folder1', 'Folder/With/Slashes');
      const folders: FolderInterface[] = [folder];

      const spy = vi.spyOn(commonUtils, 'prepareEntityName');

      getPathToFolderById(folders, folder.id, { prepareNames: true });

      expect(spy).toHaveBeenCalledWith('folder1', { prepareNames: true });
    });

    it('should use default folder name for empty name', () => {
      const folder = createFolder('', 'folder1');
      const folders: FolderInterface[] = [folder];

      expect(
        getPathToFolderById(folders, folder.id, { prepareNames: true }),
      ).toEqual({
        path: DEFAULT_FOLDER_NAME,
        pathDepth: 0,
      });
    });
  });

  describe('validateFolderRenaming', () => {
    it('should return error for duplicate folder name', () => {
      const folder1 = createFolder('Folder 1', 'parent');
      const folder2 = createFolder('Folder 2', 'parent');
      const folders: FolderInterface[] = [folder1, folder2];

      const result = validateFolderRenaming(folders, 'Folder 2', folder1.id);
      expect(result).toBe('Not allowed to have folders with same names');
    });

    it('should return error for invalid symbols', () => {
      const folder = createFolder('Folder 1', 'parent');
      const folders: FolderInterface[] = [folder];

      const result = validateFolderRenaming(folders, 'Folder%1', folder.id);
      expect(result).toContain('are not allowed in folder name');
    });

    it('should return error for name ending with dots', () => {
      const folder = createFolder('Folder 1', 'parent');
      const folders: FolderInterface[] = [folder];

      const result = validateFolderRenaming(folders, 'Folder1.', 'folder1');
      expect(result).toBe('Using a dot at the end of a name is not permitted.');
    });

    it('should allow same name if mustBeUnique is false', () => {
      const folder1 = createFolder('Folder 1', 'parent');
      const folder2 = createFolder('Folder 2', 'parent');
      const folders: FolderInterface[] = [folder1, folder2];

      const result = validateFolderRenaming(
        folders,
        'Folder 2',
        'folder1',
        false,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('sortByName', () => {
    it('should sort entities by name case-insensitively', () => {
      const entities: Entity[] = [
        { id: 'root/Entity 1', name: 'Entity 1', folderId: 'root' },
        { id: 'root/Entity 2', name: 'Entity 2', folderId: 'root' },
        { id: 'root/Entity 3', name: 'Entity 3', folderId: 'root' },
      ];

      const sorted = sortByName(entities);
      expect(sorted.map((e) => e.name)).toEqual([
        'Entity 1',
        'Entity 2',
        'Entity 3',
      ]);
    });
  });

  describe.only('updateMovedFolderId', () => {
    it('should update folder ID when it matches old parent ID', () => {
      const result1 = updateMovedFolderId(
        'oldParent',
        'newParent',
        'oldParent',
      );
      const result2 = updateMovedFolderId(
        'old/parent',
        'new/parent',
        'old/parent',
      );
      expect(result1).toBe('newParent');
      expect(result2).toBe('new/parent');
    });

    it('should update folder ID when it starts with old parent ID', () => {
      const result1 = updateMovedFolderId(
        'old/parent',
        'new/parent',
        'old/parent/child',
      );
      const result2 = updateMovedFolderId(
        'old/parent',
        'newParent',
        'old/parent/child',
      );
      expect(result1).toBe('new/parent/child');
      expect(result2).toBe('newParent/child');
    });

    it("should not update folder ID when it doesn't match old parent ID", () => {
      const result = updateMovedFolderId(
        'old/parent',
        'new/parent',
        'different/path',
      );
      expect(result).toBe('different/path');
    });
  });

  describe('updateMovedEntityId', () => {
    it('should update entity ID when it starts with old parent folder ID', () => {
      const result1 = updateMovedEntityId(
        'oldParent',
        'newParent',
        'oldParent/entity',
      );
      const result2 = updateMovedEntityId(
        'old/parent',
        'new/parent',
        'old/parent/entity',
      );

      const result3 = updateMovedEntityId(
        'old/parent',
        'newParent',
        'old/parent/entity',
      );

      const result4 = updateMovedEntityId(
        'old/parent',
        'newParent',
        'old/parent/entity',
      );
      expect(result1).toBe('newParent/entity');
      expect(result2).toBe('new/parent/entity');
      expect(result3).toBe('newParent/entity');
      expect(result4).toBe('newParent/entity');
    });

    it("should not update entity ID when it doesn't match old parent folder ID", () => {
      const result = updateMovedEntityId(
        'old/parent',
        'new/parent',
        'differentPath/entity',
      );
      expect(result).toBe('differentPath/entity');
    });
  });

  describe('getFolderIdFromEntityId', () => {
    it('should extract folder ID from entity ID', () => {
      const entityId = 'api-key/bucket/folder1/folder2/entity';
      expect(getFolderIdFromEntityId(entityId)).toBe(
        'api-key/bucket/folder1/folder2',
      );
    });
  });

  describe('getRootFolderIdFromEntityId', () => {
    it('should extract root folder ID from entity ID', () => {
      const entityId = 'api-key/bucket/folder1/folder2/entity';
      expect(getRootFolderIdFromEntityId(entityId)).toBe(
        'api-key/bucket/folder1',
      );
    });

    it('should handle root entities correctly', () => {
      const entityId = 'api-key/bucket/entity';
      expect(getRootFolderIdFromEntityId(entityId)).toBe('api-key/bucket');
    });
  });

  describe('isFolderEmpty', () => {
    it('should return true when folder has no children or entities', () => {
      const folder1 = createFolder('folder1', 'Folder 1');
      const folders: FolderInterface[] = [folder1];
      const entities: Entity[] = [];

      expect(isFolderEmpty({ id: 'folder1', folders, entities })).toBe(true);
    });

    it('should return false when folder has child folders', () => {
      const folder1 = createFolder('folder1', 'Folder 1');
      const folder2 = createFolder('Folder 2', 'folder1');
      const folders: FolderInterface[] = [folder1, folder2];
      const entities: Entity[] = [];

      expect(isFolderEmpty({ id: 'folder1', folders, entities })).toBe(false);
    });

    it('should return false when folder has entities', () => {
      const folder1 = createFolder('folder1', 'Folder 1');
      const folders: FolderInterface[] = [folder1];
      const entities: Entity[] = [
        {
          id: 'entity1',
          name: 'Entity 1',
          folderId: 'folder1',
        },
      ];

      expect(isFolderEmpty({ id: 'folder1', folders, entities })).toBe(false);
    });
  });

  describe('canEditSharedFolderOrParent', () => {
    it('should return false when folder is not shared', () => {
      const folder = createFolder('folder1', 'Folder 1');
      const folders: FolderInterface[] = [folder];

      expect(canEditSharedFolderOrParent(folders, 'folder1')).toBe(false);
    });

    it('should return true when folder is shared with write permission', () => {
      const folder: FolderInterface = {
        id: 'conversations/bucket/Folder1',
        name: 'Folder 1',
        type: FeatureType.Chat,
        folderId: 'conversations/bucket',
        sharedWithMe: true,
        permissions: [SharePermission.WRITE],
      };
      const folders: FolderInterface[] = [folder];

      expect(
        canEditSharedFolderOrParent(folders, 'conversations/bucket/Folder1'),
      ).toBe(true);
    });

    it('should return true when parent folder is shared with write permission', () => {
      const parentFolder: FolderInterface = {
        id: 'conversations/bucket/Parent Folder',
        name: 'Parent Folder',
        type: FeatureType.Chat,
        folderId: '',
        sharedWithMe: true,
        permissions: [SharePermission.WRITE],
      };
      const childFolder = createFolder('Child Folder', parentFolder.id);
      const folders: FolderInterface[] = [parentFolder, childFolder];

      expect(canEditSharedFolderOrParent(folders, childFolder.id)).toBe(true);
    });
  });

  describe('getGeneratedFolderId', () => {
    it('should generate correct folder ID', () => {
      const folder = createFolder('Child Folder', 'parent/folder');
      expect(getGeneratedFolderId(folder)).toBe('parent/folder/Child Folder');
    });
  });

  describe('addGeneratedFolderId', () => {
    it('should add generated ID to folder without ID', () => {
      const folder: Omit<FolderInterface, 'id'> = {
        name: 'Child Folder',
        type: FeatureType.Chat,
        folderId: 'parent/folder',
      };

      const result = addGeneratedFolderId(folder as FolderInterface);
      expect(result.id).toBe('parent/folder/Child Folder');
    });

    it('should not change ID if it already matches the generated one', () => {
      const folder: FolderInterface = {
        id: 'parent/folder/Child Folder',
        name: 'Child Folder',
        type: FeatureType.Chat,
        folderId: 'parent/folder',
      };

      const result = addGeneratedFolderId(folder);
      expect(result).toBe(folder);
    });
  });

  describe('getParentFolderIdsFromFolderId', () => {
    it('should return empty array for undefined path', () => {
      expect(getParentFolderIdsFromFolderId(undefined)).toEqual([]);
    });

    it('should return all parent folder IDs', () => {
      const path = 'entity/bucket/folder1/folder2/folder3';
      const expected = [
        'entity/bucket/folder1',
        'entity/bucket/folder1/folder2',
        'entity/bucket/folder1/folder2/folder3',
      ];

      expect(getParentFolderIdsFromFolderId(path)).toEqual(expected);
    });
  });

  describe('getFolderFromId', () => {
    it('should create folder object from ID', () => {
      const id = 'api-key/bucket/folder1/folder2';
      const type: FeatureType = FeatureType.Chat;

      const result = getFolderFromId(id, type);

      expect(result).toEqual({
        id: 'api-key/bucket/folder1/folder2',
        name: 'folder2',
        type: FeatureType.Chat,
        folderId: 'api-key/bucket/folder1',
      });
    });
  });

  describe('updateEntityFolder', () => {
    it('should update entity with new folder ID', () => {
      const entity: Entity = {
        id: 'source/folder/entity',
        name: 'Entity',
        folderId: 'source/folder',
      };

      const result = updateEntityFolder(
        entity,
        'source/folder',
        'target/folder',
      );

      expect(result).toEqual({
        id: 'target/folder/entity',
        name: 'Entity',
        folderId: 'target/folder',
      });
    });

    it('should not update entity if it is not in the source folder', () => {
      const entity: Entity = {
        id: 'other/folder/entity',
        name: 'Entity',
        folderId: 'other/folder',
      };

      const result = updateEntityFolder(
        entity,
        'source/folder',
        'target/folder',
      );

      expect(result).toBe(entity);
    });
  });

  describe('updateChildAndCurrentFoldersIds', () => {
    it('should update folder IDs correctly', () => {
      const ids = [
        'old/folder',
        'old/folder/subfolder1',
        'old/folder/subfolder2',
        'other/folder',
      ];

      const result = updateChildAndCurrentFoldersIds(
        ids,
        'old/folder',
        'new/folder',
      );

      expect(result).toEqual([
        'new/folder',
        'new/folder/subfolder1',
        'new/folder/subfolder2',
        'other/folder',
      ]);
    });
  });

  describe('isParentFolderSelected', () => {
    it('should return true if parent folder is selected', () => {
      const currentFolderId = 'entity/bucket/parent/folder/subfolder';
      const selectedFolderIds = ['entity/bucket/parent/folder/'];

      expect(
        isParentFolderSelected({ currentFolderId, selectedFolderIds }),
      ).toBe(true);
    });

    it('should return false if parent folder is not selected', () => {
      const currentFolderId = 'entity/bucket/parent/folder/subfolder';
      const selectedFolderIds = ['entity/bucket/other/folder/'];

      expect(
        isParentFolderSelected({ currentFolderId, selectedFolderIds }),
      ).toBe(false);
    });
  });

  describe('isFolderPartialSelected', () => {
    it('should return true if folder is partial selected and not fully selected', () => {
      const currentFolderId = 'folder';
      const partialSelectedFolderIds = ['folder/'];
      const isSelected = false;

      expect(
        isFolderPartialSelected({
          currentFolderId,
          partialSelectedFolderIds,
          isSelected,
        }),
      ).toBe(true);
    });

    it('should return false if folder is fully selected', () => {
      const currentFolderId = 'folder';
      const partialSelectedFolderIds = ['folder/'];
      const isSelected = true;

      expect(
        isFolderPartialSelected({
          currentFolderId,
          partialSelectedFolderIds,
          isSelected,
        }),
      ).toBe(false);
    });
  });

  describe('getSelectedEntitiesByFolderId', () => {
    it('should get entities by folder ID', () => {
      const entities: Entity[] = [
        {
          id: 'folder/entity1',
          name: 'Entity 1',
          folderId: 'folder',
        },
        {
          id: 'folder/entity2',
          name: 'Entity 2',
          folderId: 'folder',
        },
        {
          id: 'other/folder/entity3',
          name: 'Entity 3',
          folderId: 'other/folder',
        },
      ];

      const result = getSelectedEntitiesByFolderId({
        entities,
        folderId: 'folder',
        partialChosenFolderIds: [],
        chosenItemsIds: [],
      });

      expect(result).toEqual(['folder/entity1', 'folder/entity2']);
    });

    it('should exclude chosen items when folder is partially chosen', () => {
      const entities: Entity[] = [
        {
          id: 'folder/entity1',
          name: 'Entity 1',
          folderId: 'folder',
        },
        {
          id: 'folder/entity2',
          name: 'Entity 2',
          folderId: 'folder',
        },
      ];

      const result = getSelectedEntitiesByFolderId({
        entities,
        folderId: 'folder',
        partialChosenFolderIds: ['folder'],
        chosenItemsIds: ['folder/entity1'],
      });

      expect(result).toEqual(['folder/entity2']);
    });
  });
});
