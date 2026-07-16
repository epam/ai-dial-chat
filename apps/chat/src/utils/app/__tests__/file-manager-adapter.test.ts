import { beforeAll, describe, expect, it } from 'vitest';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { buildFileTree } from '@/src/utils/app/file-manager-adapter';

import { ApiKeys, FeatureType } from '@/src/types/common';
import { DialFile, FileFolderInterface } from '@/src/types/files';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

const ownerBucket = 'owner-bucket';

beforeAll(() => {
  BucketService.setBucket(ownerBucket);
});

describe('buildFileTree - shared with me root items (Issue #7836 regression)', () => {
  it('materializes only the immediate parent folder for a root-shared file, not its deeper unshared ancestors', () => {
    // Arrange
    const fileId = `${ApiKeys.Files}/${ownerBucket}/Folder1/Folder2/File1`;
    const immediateParentId = `${ApiKeys.Files}/${ownerBucket}/Folder1/Folder2`;

    const sharedFile: DialFile = {
      id: fileId,
      name: 'File1',
      folderId: immediateParentId,
      contentLength: 10,
      contentType: 'text/plain',
      sharedWithMe: true,
      isRootSharedItem: true,
    };

    const folders: FileFolderInterface[] = [];

    // Act
    const { rootFolder } = buildFileTree([sharedFile], folders);

    // Assert
    expect(rootFolder.items).toHaveLength(1);
    const parentFolder = rootFolder.items?.[0];
    expect(parentFolder?.nodeType).toBe(DialFileNodeType.FOLDER);
    expect(parentFolder?.id).toBe(immediateParentId);
    expect(parentFolder?.items).toHaveLength(1);
    expect(parentFolder?.items?.[0].id).toBe(fileId);

    const rootFolderNames = (rootFolder.items ?? []).map((item) => item.name);
    expect(rootFolderNames).not.toContain('Folder1');
  });

  it('places a root-shared folder at the tree root without synthesizing its unshared ancestor folders', () => {
    // Arrange
    const sharedFolderId = `${ApiKeys.Files}/${ownerBucket}/Folder1/Folder2`;
    const parentFolderId = `${ApiKeys.Files}/${ownerBucket}/Folder1`;

    const sharedFolder: FileFolderInterface = {
      id: sharedFolderId,
      name: 'Folder2',
      folderId: parentFolderId,
      type: FeatureType.File,
      status: UploadStatus.LOADED,
      sharedWithMe: true,
      isRootSharedItem: true,
    };

    // Act
    const { rootFolder } = buildFileTree([], [sharedFolder]);

    // Assert
    expect(rootFolder.items).toHaveLength(1);
    expect(rootFolder.items?.[0].id).toBe(sharedFolderId);

    const folderNames = (rootFolder.items ?? []).map((item) => item.name);
    expect(folderNames).not.toContain('Folder1');
  });
});
