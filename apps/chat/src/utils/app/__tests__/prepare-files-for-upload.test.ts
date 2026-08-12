import { describe, expect, it, vi } from 'vitest';

import {
  applyUploadReplaceActions,
  detectUploadFileConflicts,
  dispatchPreparedFileUploads,
} from '@/src/utils/app/prepare-files-for-upload';

import { ReplaceOptions } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { HTTPMethod } from '@/src/types/http';

import { FilesActions } from '@/src/store/actions';

const makeFile = (partial: Partial<DialFile>): DialFile =>
  ({
    contentLength: 7,
    contentType: 'image/jpeg',
    ...partial,
  }) as DialFile;

describe('detectUploadFileConflicts', () => {
  const folderId = 'files/test-bucket/uploads';

  it('detects conflicts with existing folder files', () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });

    const { duplicatedFiles, nonDuplicatedFiles } = detectUploadFileConflicts({
      files: [file],
      folderId,
      existingFiles: [
        makeFile({
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
        }),
      ],
      bucket: 'test-bucket',
      allowedTypes: ['*/*'],
    });

    expect(duplicatedFiles).toHaveLength(1);
    expect(duplicatedFiles[0].name).toBe('sun.jpg');
    expect(nonDuplicatedFiles).toHaveLength(0);
  });

  it('detects duplicate names within the same batch', () => {
    const first = new File(['a'], 'cloud.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'cloud.jpg', { type: 'image/jpeg' });

    const { duplicatedFiles, nonDuplicatedFiles } = detectUploadFileConflicts({
      files: [first, second],
      folderId,
      existingFiles: [],
      bucket: 'test-bucket',
      allowedTypes: ['*/*'],
    });

    expect(nonDuplicatedFiles.map(({ name }) => name)).toEqual(['cloud.jpg']);
    expect(duplicatedFiles).toHaveLength(1);
    expect(duplicatedFiles[0].name).toBe('cloud.jpg');
  });
});

describe('applyUploadReplaceActions', () => {
  const folderId = 'files/test-bucket/uploads';

  it('applies postfix strategy to conflicting files', () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });
    const duplicatedFile = makeFile({
      id: `${folderId}/sun.jpg`,
      name: 'sun.jpg',
      folderId,
      fileContent: file,
    });

    const resolved = applyUploadReplaceActions({
      duplicatedFiles: [duplicatedFile],
      nonDuplicatedFiles: [],
      mappedActions: { [duplicatedFile.id]: ReplaceOptions.Postfix },
      existingFiles: [
        makeFile({
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
        }),
      ],
      folderId,
      bucket: 'test-bucket',
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe('sun 1.jpg');
    expect(resolved[0].id).toBe('files/test-bucket/uploads/sun 1.jpg');
  });

  it('applies replace strategy with PUT method', () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });
    const duplicatedFile = makeFile({
      id: `${folderId}/sun.jpg`,
      name: 'sun.jpg',
      folderId,
      fileContent: file,
    });

    const resolved = applyUploadReplaceActions({
      duplicatedFiles: [duplicatedFile],
      nonDuplicatedFiles: [],
      mappedActions: { [duplicatedFile.id]: ReplaceOptions.Replace },
      existingFiles: [
        makeFile({
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
        }),
      ],
      folderId,
      bucket: 'test-bucket',
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].name).toBe('sun.jpg');
    expect(resolved[0].httpMethod).toBe(HTTPMethod.PUT);
  });

  it('skips ignored files', () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });
    const duplicatedFile = makeFile({
      id: `${folderId}/sun.jpg`,
      name: 'sun.jpg',
      folderId,
      fileContent: file,
    });

    const resolved = applyUploadReplaceActions({
      duplicatedFiles: [duplicatedFile],
      nonDuplicatedFiles: [],
      mappedActions: { [duplicatedFile.id]: ReplaceOptions.Ignore },
      existingFiles: [
        makeFile({
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
        }),
      ],
      folderId,
      bucket: 'test-bucket',
    });

    expect(resolved).toHaveLength(0);
  });
});

describe('dispatchPreparedFileUploads', () => {
  it('dispatches upload actions and optional selection', () => {
    const dispatch = vi.fn();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const preparedFile = {
      id: 'files/test-bucket/uploads/test.txt',
      name: 'test.txt',
      fileContent: file,
    };

    const ids = dispatchPreparedFileUploads(
      dispatch,
      [preparedFile],
      'uploads',
      {
        bucket: 'test-bucket',
        showSuccessMessage: true,
        selectFileIds: true,
      },
    );

    expect(ids).toEqual([preparedFile.id]);
    expect(dispatch).toHaveBeenCalledWith(
      FilesActions.uploadFile({
        fileContent: file,
        id: preparedFile.id,
        relativePath: 'uploads',
        name: 'test.txt',
        bucket: 'test-bucket',
        showSuccessMessage: true,
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      FilesActions.selectFiles({ ids: [preparedFile.id] }),
    );
  });

  it('dispatches upload with httpMethod when provided', () => {
    const dispatch = vi.fn();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const preparedFile = {
      id: 'files/test-bucket/uploads/test.txt',
      name: 'test.txt',
      fileContent: file,
      httpMethod: HTTPMethod.PUT,
    };

    dispatchPreparedFileUploads(dispatch, [preparedFile], 'uploads');

    expect(dispatch).toHaveBeenCalledWith(
      FilesActions.uploadFile({
        fileContent: file,
        id: preparedFile.id,
        relativePath: 'uploads',
        name: 'test.txt',
        httpMethod: HTTPMethod.PUT,
      }),
    );
  });
});
