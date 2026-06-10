import { describe, expect, it, vi } from 'vitest';

import {
  dispatchPreparedFileUploads,
  prepareFilesForUpload,
} from '@/src/utils/app/prepare-files-for-upload';

import { FilesActions } from '@/src/store/actions';

describe('prepareFilesForUpload', () => {
  const folderId = 'files/test-bucket/uploads';

  it('auto-renames files that conflict with existing folder files', () => {
    const file = new File(['content'], 'sun.jpg', { type: 'image/jpeg' });

    const { preparedFiles } = prepareFilesForUpload({
      files: [file],
      folderId,
      existingFiles: [
        {
          id: `${folderId}/sun.jpg`,
          name: 'sun.jpg',
          folderId,
        },
      ],
      bucket: 'test-bucket',
    });

    expect(preparedFiles).toHaveLength(1);
    expect(preparedFiles[0].name).toBe('sun 1.jpg');
    expect(preparedFiles[0].id).toBe('files/test-bucket/uploads/sun 1.jpg');
  });

  it('auto-renames duplicate names within the same batch', () => {
    const first = new File(['a'], 'cloud.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'cloud.jpg', { type: 'image/jpeg' });

    const { preparedFiles } = prepareFilesForUpload({
      files: [first, second],
      folderId,
      existingFiles: [],
      bucket: 'test-bucket',
    });

    expect(preparedFiles.map(({ name }) => name)).toEqual([
      'cloud.jpg',
      'cloud 1.jpg',
    ]);
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
});
