import type { ListFilesItemDto } from '@epam/ai-dial-chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialFilesApi } from '../../dial-files-api';
import type { UseDialFileListingOptions } from '../useDialFileListing';
import { useDialFileListing } from '../useDialFileListing';

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

const emptySharedListResponse = { bucket: '', path: '', items: [] };
const emptyPublicListResponse = { bucket: 'public', path: '', items: [] };
const emptySharedByMeResponse = { bucket: BUCKET, path: '', items: [] };

let filesApi: DialFilesApi;

beforeEach(() => {
  filesApi = makeFilesApi();
  vi.mocked(filesApi.listFiles).mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
    nextToken: undefined,
  });
  vi.mocked(filesApi.listSharedFiles).mockResolvedValue(
    emptySharedListResponse,
  );
  vi.mocked(filesApi.listPublicFiles).mockResolvedValue(
    emptyPublicListResponse,
  );
  vi.mocked(filesApi.listSharedByMe).mockResolvedValue(emptySharedByMeResponse);
});

const renderListing = (overrides: Partial<UseDialFileListingOptions> = {}) =>
  renderHook(() =>
    useDialFileListing({
      filesApi,
      bucket: BUCKET,
      rootLabel: 'My files',
      activeTab: DialFileManagerTabs.MyFiles,
      ...overrides,
    }),
  );

describe('useDialFileListing', () => {
  it('switching tabs resets folderPath to root and clears the listing cache', async () => {
    vi.mocked(filesApi.listFiles).mockResolvedValue({
      bucket: BUCKET,
      path: 'reports/',
      items: [],
      permissions: ['READ', 'WRITE'],
    });

    const { result, rerender } = renderHook(
      ({ tab }: { tab: DialFileManagerTabs }) =>
        useDialFileListing({
          filesApi,
          bucket: BUCKET,
          rootLabel: 'My files',
          activeTab: tab,
        }),
      { initialProps: { tab: DialFileManagerTabs.MyFiles } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.path).toBe('/My files/reports/'));

    vi.mocked(filesApi.listPublicFiles).mockClear();

    rerender({ tab: DialFileManagerTabs.Organization });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.path).toBe('/My files');
    expect(filesApi.listPublicFiles).toHaveBeenCalled();
  });

  it('falls back to the parent folder when the current folder 404s (e.g. emptied and removed)', async () => {
    vi.mocked(filesApi.listFiles).mockImplementation((query) => {
      if (query.path === 'reports/') {
        return Promise.reject(
          Object.assign(new Error('Not Found'), {
            response: { status: 404, json: () => Promise.resolve({}) },
          }),
        );
      }
      return Promise.resolve({
        bucket: BUCKET,
        path: '',
        items: [],
        nextToken: undefined,
      });
    });

    const { result } = renderListing();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));

    await waitFor(() => expect(result.current.folderPath).toBe(''));
    expect(result.current.error).toBeNull();
    expect(result.current.path).toBe('/My files');
  });

  describe('onSearchFiles', () => {
    it('debounces search and calls listFiles only once after 300ms', async () => {
      vi.mocked(filesApi.listFiles).mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'report.pdf',
            path: 'report.pdf',
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
        ],
        nextToken: undefined,
      });

      const { result } = renderListing();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCallCount = vi.mocked(filesApi.listFiles).mock.calls.length;

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'rep'));
        act(() => result.current.onSearchFiles('/', 'repo'));
        act(() => result.current.onSearchFiles('/', 'repor'));

        expect(filesApi.listFiles).toHaveBeenCalledTimes(initialCallCount);

        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        expect(filesApi.listFiles).toHaveBeenCalledTimes(initialCallCount + 1);
        const lastCall = vi.mocked(filesApi.listFiles).mock.calls[
          vi.mocked(filesApi.listFiles).mock.calls.length - 1
        ][0];
        expect(lastCall).toMatchObject({ recursive: true });
        expect(result.current.searchResults).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels in-flight search when a second query arrives before the first resolves', async () => {
      const { result } = renderListing();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCallCount = vi.mocked(filesApi.listFiles).mock.calls.length;

      let resolveFirst!: (value: {
        bucket: string;
        path: string;
        items: ListFilesItemDto[];
        nextToken: undefined;
      }) => void;
      const firstPromise = new Promise<{
        bucket: string;
        path: string;
        items: ListFilesItemDto[];
        nextToken: undefined;
      }>((res) => {
        resolveFirst = res;
      });
      vi.mocked(filesApi.listFiles)
        .mockReturnValueOnce(firstPromise)
        .mockResolvedValue({
          bucket: BUCKET,
          path: '',
          items: [],
          nextToken: undefined,
        });

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'first'));
        act(() => {
          vi.advanceTimersByTime(300);
        });

        act(() => result.current.onSearchFiles('/', 'second'));
        act(() => {
          vi.advanceTimersByTime(300);
        });

        // Flush second fetch (empty result)
        await act(() => Promise.resolve());

        expect(filesApi.listFiles).toHaveBeenCalledTimes(initialCallCount + 2);
        expect(result.current.isSearching).toBe(false);

        // Resolve the stale first fetch — its result should be ignored
        resolveFirst({
          bucket: BUCKET,
          path: '',
          items: [
            {
              name: 'first-only.pdf',
              path: 'first-only.pdf',
              folderId: `${BUCKET}:`,
              nodeType: ListFilesItemDtoNodeTypeEnum.Item,
              bucket: BUCKET,
            },
          ],
          nextToken: undefined,
        });
        await act(() => Promise.resolve());

        expect(
          result.current.searchResults?.some(
            (r) => r.name === 'first-only.pdf',
          ),
        ).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reconstructs virtual path for a nested file returned by search', async () => {
      const nestedItem: ListFilesItemDto = {
        name: 'summary.pdf',
        path: 'reports/q1/summary.pdf',
        url: `files/${BUCKET}/reports/q1/summary.pdf`,
        folderId: `${BUCKET}:reports/q1/`,
        nodeType: ListFilesItemDtoNodeTypeEnum.Item,
        bucket: BUCKET,
      };
      vi.mocked(filesApi.listFiles).mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [nestedItem],
        nextToken: undefined,
      });

      const { result } = renderListing();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'summary'));
        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        const found = result.current.searchResults?.find(
          (r) => r.name === 'summary.pdf',
        );
        expect(found).toBeDefined();
        expect(found?.path).toBe('/My files/reports/q1/summary.pdf');
        expect(found?.parentPath).toBe('/My files/reports/q1');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('sharedWithMeIds', () => {
    const sharedRootItem: ListFilesItemDto = {
      name: 'team-docs',
      path: `files/${OWNER_BUCKET}/team-docs/`,
      folderId: `${OWNER_BUCKET}:files/${OWNER_BUCKET}/team-docs/`,
      nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
      bucket: OWNER_BUCKET,
      permissions: ['READ', 'WRITE'],
      author: 'Owner User',
    };

    it('is populated with virtual DialFile paths matching root Shared listing items', async () => {
      vi.mocked(filesApi.listSharedFiles).mockResolvedValue({
        bucket: '',
        path: '',
        items: [sharedRootItem],
      });

      const { result } = renderListing({
        activeTab: DialFileManagerTabs.Shared,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.sharedWithMeIds).toEqual(['/My files/team-docs/']);
    });

    it('is undefined on MyFiles tab', async () => {
      const { result } = renderListing({
        activeTab: DialFileManagerTabs.MyFiles,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sharedWithMeIds).toBeUndefined();
    });

    it('is undefined on Organization tab', async () => {
      const { result } = renderListing({
        activeTab: DialFileManagerTabs.Organization,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sharedWithMeIds).toBeUndefined();
    });

    it('matches the actual root item virtual path exposed via items', async () => {
      vi.mocked(filesApi.listSharedFiles).mockResolvedValue({
        bucket: '',
        path: '',
        items: [sharedRootItem],
      });

      const { result } = renderListing({
        activeTab: DialFileManagerTabs.Shared,
        rootLabel: 'Shared with me',
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const rootFolder = result.current.items[0];
      const teamDocsNode = rootFolder.items?.find(
        (i) => i.name === 'team-docs',
      );
      expect(teamDocsNode).toBeDefined();
      expect(result.current.sharedWithMeIds).toEqual([teamDocsNode?.path]);
    });
  });

  describe('sharedByMePaths', () => {
    it('is populated with virtual DialFile paths matching listSharedByMe items', async () => {
      vi.mocked(filesApi.listSharedByMe).mockResolvedValue({
        bucket: BUCKET,
        path: '',
        items: [
          {
            name: 'a.pdf',
            path: `files/${BUCKET}/a.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
          {
            name: 'nested.pdf',
            path: `files/${BUCKET}/reports/2024/nested.pdf`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Item,
            bucket: BUCKET,
          },
          {
            name: 'shared-folder',
            path: `files/${BUCKET}/shared-folder/`,
            folderId: `${BUCKET}:`,
            nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
            bucket: BUCKET,
          },
        ],
      });

      const { result } = renderListing({
        activeTab: DialFileManagerTabs.MyFiles,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await waitFor(() => expect(result.current.sharedByMePaths.size).toBe(3));

      expect(result.current.sharedByMePaths).toEqual(
        new Set([
          '/My files/a.pdf',
          '/My files/reports/2024/nested.pdf',
          '/My files/shared-folder/',
        ]),
      );
    });

    it('is empty on the Shared tab', async () => {
      const { result } = renderListing({
        activeTab: DialFileManagerTabs.Shared,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sharedByMePaths.size).toBe(0);
      expect(filesApi.listSharedByMe).not.toHaveBeenCalled();
    });

    it('is empty on the Organization tab', async () => {
      const { result } = renderListing({
        activeTab: DialFileManagerTabs.Organization,
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.sharedByMePaths.size).toBe(0);
    });
  });
});
