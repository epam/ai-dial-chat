import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileManagerNotificationReason } from '../../dial-file-manager.types';
import type { DialFilesApi } from '../../dial-files-api';
import type { UseDialFileMetadataOptions } from '../useDialFileMetadata';
import { useDialFileMetadata } from '../useDialFileMetadata';

const makeFilesApi = (overrides: Partial<DialFilesApi> = {}): DialFilesApi =>
  ({
    listFiles: vi.fn(),
    listPublicFiles: vi.fn(),
    listSharedFiles: vi.fn(),
    listSharedByMe: vi.fn(),
    getFileMetadata: vi.fn(),
    uploadFile: vi.fn(),
    uploadArchive: vi.fn(),
    createFolder: vi.fn(),
    deleteFiles: vi.fn(),
    renameFiles: vi.fn(),
    copyFiles: vi.fn(),
    moveFiles: vi.fn(),
    downloadFile: vi.fn(),
    downloadArchive: vi.fn(),
    revokeAccess: vi.fn(),
    discardShared: vi.fn(),
    ...overrides,
  }) as DialFilesApi;

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

describe('useDialFileMetadata', () => {
  const myFilesItem = {
    id: `files/${BUCKET}/report.pdf`,
    name: 'report.pdf',
    path: '/My files/report.pdf',
    parentPath: '/My files',
    nodeType: DialFileNodeType.ITEM,
    folderId: `${BUCKET}:`,
    bucket: BUCKET,
  };

  const metadataResponse = {
    name: 'report.pdf',
    nodeType: 'item',
    bucket: BUCKET,
    contentLength: 1234,
    contentType: 'application/pdf',
    author: 'Jane Doe',
    permissions: ['READ', 'WRITE'],
    updatedAt: 1700000000000,
  };

  let filesApi: DialFilesApi;

  beforeEach(() => {
    filesApi = makeFilesApi();
    vi.mocked(filesApi.getFileMetadata).mockResolvedValue(metadataResponse);
  });

  const renderMetadata = (
    overrides: Partial<UseDialFileMetadataOptions> = {},
  ) =>
    renderHook(() =>
      useDialFileMetadata({
        filesApi,
        bucket: BUCKET,
        rootLabel: 'My files',
        ...overrides,
      }),
    );

  it('resolves the current user bucket for a my_files item', async () => {
    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(myFilesItem));
    expect(result.current.isFileMetadataLoading).toBe(true);

    await waitFor(() =>
      expect(filesApi.getFileMetadata).toHaveBeenCalledWith({
        bucket: BUCKET,
        path: 'report.pdf',
      }),
    );
    await waitFor(() =>
      expect(result.current.isFileMetadataLoading).toBe(false),
    );
    expect(result.current.fileMetadata).toMatchObject({
      path: '/My files/report.pdf',
      contentLength: 1234,
      author: 'Jane Doe',
    });
  });

  it('resolves the owner bucket for a root-level shared item', async () => {
    const sharedRootFile = {
      id: `files/${OWNER_BUCKET}/notes.txt`,
      name: 'notes.txt',
      path: '/Shared with me/notes.txt',
      parentPath: '/Shared with me',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${OWNER_BUCKET}:`,
      bucket: OWNER_BUCKET,
    };

    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(sharedRootFile));

    await waitFor(() =>
      expect(filesApi.getFileMetadata).toHaveBeenCalledWith({
        bucket: OWNER_BUCKET,
        path: 'notes.txt',
      }),
    );
  });

  it('resolves the owner bucket for a nested shared item', async () => {
    const nestedSharedFile = {
      id: `files/${OWNER_BUCKET}/team-docs/report.pdf`,
      name: 'report.pdf',
      path: '/Shared with me/team-docs/report.pdf',
      parentPath: '/Shared with me/team-docs',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
      bucket: OWNER_BUCKET,
    };

    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(nestedSharedFile));

    await waitFor(() =>
      expect(filesApi.getFileMetadata).toHaveBeenCalledWith({
        bucket: OWNER_BUCKET,
        path: 'team-docs/report.pdf',
      }),
    );
  });

  it('resolves the item bucket for an organization item', async () => {
    const publicBucket = 'public-bucket';
    const orgFile = {
      id: `files/${publicBucket}/guide.pdf`,
      name: 'guide.pdf',
      path: '/Organization/guide.pdf',
      parentPath: '/Organization',
      nodeType: DialFileNodeType.ITEM,
      folderId: `${publicBucket}:`,
      bucket: publicBucket,
    };

    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(orgFile));

    await waitFor(() =>
      expect(filesApi.getFileMetadata).toHaveBeenCalledWith({
        bucket: publicBucket,
        path: 'guide.pdf',
      }),
    );
  });

  it('reports a structured notification and clears loading when getFileMetadata rejects', async () => {
    vi.mocked(filesApi.getFileMetadata).mockRejectedValue(new Error('failed'));
    const onNotification = vi.fn();

    const { result } = renderMetadata({ onNotification });

    act(() => result.current.onGetInfo(myFilesItem));

    await waitFor(() =>
      expect(onNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        reason: FileManagerNotificationReason.MetadataLoadFailed,
      }),
    );
    expect(result.current.isFileMetadataLoading).toBe(false);
  });

  it('clearMetadata resets fileMetadata and isFileMetadataLoading', async () => {
    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(myFilesItem));
    await waitFor(() =>
      expect(result.current.fileMetadata).not.toBeUndefined(),
    );

    act(() => result.current.clearMetadata());

    expect(result.current.fileMetadata).toBeUndefined();
    expect(result.current.isFileMetadataLoading).toBe(false);
  });
});
