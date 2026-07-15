import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFolder, listPublicFiles } from '../../../server-api/files.api';
import { usePublishFolders } from '../usePublishFolders';

vi.mock('../../../server-api/files.api', () => ({
  listPublicFiles: vi.fn(),
  createFolder: vi.fn(),
}));

describe('usePublishFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listPublicFiles).mockResolvedValue({
      bucket: 'public',
      path: '',
      items: [],
    });
  });

  it('loads the root folder tree on mount', async () => {
    vi.mocked(listPublicFiles).mockResolvedValue({
      bucket: 'public',
      path: '',
      items: [
        {
          name: 'Organization',
          path: 'Organization/',
          folderId: 'public:Organization/',
          nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
          bucket: 'public',
        },
      ],
    });

    const { result } = renderHook(() => usePublishFolders());

    await waitFor(() =>
      expect(result.current.folderItems).toEqual([
        { path: ['Organization'], name: 'Organization', children: undefined },
      ]),
    );
  });

  it('fetches and merges children when a folder is expanded', async () => {
    vi.mocked(listPublicFiles).mockImplementation(({ path } = {}) => {
      if (!path) {
        return Promise.resolve({
          bucket: 'public',
          path: '',
          items: [
            {
              name: 'Organization',
              path: 'Organization/',
              folderId: 'public:Organization/',
              nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
              bucket: 'public',
            },
          ],
        });
      }
      return Promise.resolve({
        bucket: 'public',
        path,
        items: [
          {
            name: 'Data Science',
            path: 'Organization/Data Science/',
            folderId: 'public:Organization/Data Science/',
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: 'public',
          },
        ],
      });
    });

    const { result } = renderHook(() => usePublishFolders());
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['Organization']));
    });

    await waitFor(() =>
      expect(result.current.folderItems[0].children).toEqual([
        {
          path: ['Organization', 'Data Science'],
          name: 'Data Science',
          children: undefined,
        },
      ]),
    );
    expect(result.current.loadedPaths.has('Organization')).toBe(true);
  });

  it('creates a folder using the bucket of the parent folder listing', async () => {
    vi.mocked(listPublicFiles).mockResolvedValue({
      bucket: 'public',
      path: '',
      items: [
        {
          name: 'Organization',
          path: 'Organization/',
          folderId: 'public:Organization/',
          nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
          bucket: 'public-bucket',
        },
      ],
    });
    vi.mocked(createFolder).mockResolvedValue({
      name: 'New folder',
      path: 'New folder/',
      parentPath: '',
      bucket: 'public-bucket',
      nodeType: 'folder',
      folderId: 'public-bucket:New folder/',
    });

    const { result } = renderHook(() => usePublishFolders());
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.onCreatePublishFolder([], 'New folder');
    });

    await waitFor(() =>
      expect(createFolder).toHaveBeenCalledWith({
        bucket: 'public-bucket',
        parentPath: undefined,
        name: 'New folder',
      }),
    );
  });

  it('denies write access under a restricted folder segment', async () => {
    const { result } = renderHook(() => usePublishFolders());
    await waitFor(() => expect(listPublicFiles).toHaveBeenCalled());
    expect(
      result.current.hasPublishWriteAccess(['Organization', 'Production']),
    ).toBe(false);
    expect(
      result.current.hasPublishWriteAccess(['Organization', 'Marketing']),
    ).toBe(true);
  });
});
