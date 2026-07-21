import { DialFileNodeType, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../../server-api/files.api';
import type { UseDialFileMetadataOptions } from '../../useDialFileMetadata';
import { useDialFileMetadata } from '../../useDialFileMetadata';

vi.mock('../../../../server-api/files.api');

const mockGetFileMetadata = vi.mocked(filesApi.getFileMetadata);

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

const renderMetadata = (overrides: Partial<UseDialFileMetadataOptions> = {}) =>
  renderHook(() =>
    useDialFileMetadata({
      bucket: BUCKET,
      rootLabel: 'My files',
      ...overrides,
    }),
  );

afterEach(() => {
  vi.clearAllMocks();
});

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

  beforeEach(() => {
    mockGetFileMetadata.mockResolvedValue(metadataResponse);
  });

  it('resolves the current user bucket for a my_files item', async () => {
    const { result } = renderMetadata();

    act(() => result.current.onGetInfo(myFilesItem));
    expect(result.current.isFileMetadataLoading).toBe(true);

    await waitFor(() =>
      expect(mockGetFileMetadata).toHaveBeenCalledWith({
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
      expect(mockGetFileMetadata).toHaveBeenCalledWith({
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
      expect(mockGetFileMetadata).toHaveBeenCalledWith({
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
      expect(mockGetFileMetadata).toHaveBeenCalledWith({
        bucket: publicBucket,
        path: 'guide.pdf',
      }),
    );
  });

  it('shows an error toast and clears loading when getFileMetadata rejects', async () => {
    mockGetFileMetadata.mockRejectedValue(new Error('failed'));
    const onNotification = vi.fn();

    const { result } = renderMetadata({ onNotification });

    act(() => result.current.onGetInfo(myFilesItem));

    await waitFor(() =>
      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({ variant: NotificationVariant.Error }),
      ),
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
