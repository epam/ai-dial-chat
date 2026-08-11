import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFolder, listPublicFiles } from '../../../server-api/files.api';
import { StorageKey } from '../../../types/storage-key';
import { usePublishFolders } from '../usePublishFolders';

vi.mock('../../../server-api/files.api', () => ({
  listPublicFiles: vi.fn(),
  createFolder: vi.fn(),
}));

describe('usePublishFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('adds a folder to the local tree without calling the create-folder API', async () => {
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

    const { result } = renderHook(() => usePublishFolders());
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    await act(async () => {
      await result.current.onCreatePublishFolder([], 'New folder');
    });

    expect(createFolder).not.toHaveBeenCalled();
    expect(result.current.folderItems).toEqual([
      { path: ['Organization'], name: 'Organization', children: undefined },
      { path: ['New folder'], name: 'New folder', children: undefined },
    ]);
  });

  it('adds a nested folder to the local tree under its parent', async () => {
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
              bucket: 'public-bucket',
            },
          ],
        });
      }
      return Promise.resolve({ bucket: 'public', path, items: [] });
    });

    const { result } = renderHook(() => usePublishFolders());
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['Organization']));
    });
    await waitFor(() =>
      expect(result.current.loadedPaths.has('Organization')).toBe(true),
    );

    await act(async () => {
      await result.current.onCreatePublishFolder(
        ['Organization'],
        'Data Science',
      );
    });

    expect(result.current.folderItems[0].children).toEqual([
      {
        path: ['Organization', 'Data Science'],
        name: 'Data Science',
        children: undefined,
      },
    ]);
  });

  describe('remembered publish destinations', () => {
    const readRemembered = () =>
      JSON.parse(
        localStorage.getItem(StorageKey.PublishDestinationFolders) ?? '[]',
      ) as string[];

    it('keeps a published folder in the tree after the panel is reopened', async () => {
      const first = renderHook(() => usePublishFolders());
      await waitFor(() => expect(listPublicFiles).toHaveBeenCalled());

      act(() => first.result.current.rememberPublishFolder(['Model releases']));
      first.unmount();

      const { result } = renderHook(() => usePublishFolders());
      await waitFor(() =>
        expect(result.current.folderItems).toEqual([
          {
            path: ['Model releases'],
            name: 'Model releases',
            children: undefined,
          },
        ]),
      );
    });

    it('merges a nested published folder under its listed parent', async () => {
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
      localStorage.setItem(
        StorageKey.PublishDestinationFolders,
        JSON.stringify(['Organization/Model releases']),
      );

      const { result } = renderHook(() => usePublishFolders());

      await waitFor(() =>
        expect(result.current.folderItems[0]?.children).toEqual([
          {
            path: ['Organization', 'Model releases'],
            name: 'Model releases',
            children: undefined,
          },
        ]),
      );
    });

    it('does not duplicate a remembered folder that the public bucket already lists', async () => {
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
      localStorage.setItem(
        StorageKey.PublishDestinationFolders,
        JSON.stringify(['Organization']),
      );

      const { result } = renderHook(() => usePublishFolders());

      await waitFor(() => expect(result.current.folderItems).toHaveLength(1));
    });

    it('stores each destination once, most recent first', async () => {
      const { result } = renderHook(() => usePublishFolders());
      await waitFor(() => expect(listPublicFiles).toHaveBeenCalled());

      act(() => result.current.rememberPublishFolder(['Alpha']));
      act(() => result.current.rememberPublishFolder(['Beta', 'Q3']));
      act(() => result.current.rememberPublishFolder(['Alpha']));

      expect(readRemembered()).toEqual(['Beta/Q3', 'Alpha']);
    });

    it('ignores the bucket root, which is not a folder node', async () => {
      const { result } = renderHook(() => usePublishFolders());
      await waitFor(() => expect(listPublicFiles).toHaveBeenCalled());

      act(() => result.current.rememberPublishFolder([]));

      expect(readRemembered()).toEqual([]);
    });
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
