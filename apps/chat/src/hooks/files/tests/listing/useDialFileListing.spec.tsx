import { DialFileManagerTabs } from '@epam/ai-dial-ui-kit';
import type { ListFilesItemDto } from '@epam/chat-api-client';
import { ListFilesItemDtoNodeTypeEnum } from '@epam/chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../../../../server-api/files.api';
import type { UseDialFileListingOptions } from '../../useDialFileListing';
import { useDialFileListing } from '../../useDialFileListing';

vi.mock('../../../../server-api/files.api');

const mockListFiles = vi.mocked(filesApi.listFiles);
const mockListSharedFiles = vi.mocked(filesApi.listSharedFiles);
const mockListPublicFiles = vi.mocked(filesApi.listPublicFiles);
const mockListSharedByMe = vi.mocked(filesApi.listSharedByMe);

const BUCKET = 'test-bucket';
const OWNER_BUCKET = 'owner-bucket';

const emptySharedListResponse = { bucket: '', path: '', items: [] };
const emptyPublicListResponse = { bucket: 'public', path: '', items: [] };
const emptySharedByMeResponse = { bucket: BUCKET, path: '', items: [] };

beforeEach(() => {
  mockListFiles.mockResolvedValue({
    bucket: BUCKET,
    path: '',
    items: [],
    nextToken: undefined,
  });
  mockListSharedFiles.mockResolvedValue(emptySharedListResponse);
  mockListPublicFiles.mockResolvedValue(emptyPublicListResponse);
  mockListSharedByMe.mockResolvedValue(emptySharedByMeResponse);
});

afterEach(() => {
  vi.clearAllMocks();
});

const renderListing = (overrides: Partial<UseDialFileListingOptions> = {}) =>
  renderHook(() =>
    useDialFileListing({
      bucket: BUCKET,
      rootLabel: 'My files',
      activeTab: DialFileManagerTabs.MyFiles,
      ...overrides,
    }),
  );

describe('useDialFileListing', () => {
  it('switching tabs resets folderPath to root and clears the listing cache', async () => {
    mockListFiles.mockResolvedValue({
      bucket: BUCKET,
      path: 'reports/',
      items: [],
      permissions: ['READ', 'WRITE'],
    });

    const { result, rerender } = renderHook(
      ({ tab }: { tab: DialFileManagerTabs }) =>
        useDialFileListing({
          bucket: BUCKET,
          rootLabel: 'My files',
          activeTab: tab,
        }),
      { initialProps: { tab: DialFileManagerTabs.MyFiles } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.onPathChange('/My files/reports/'));
    await waitFor(() => expect(result.current.path).toBe('/My files/reports/'));

    mockListPublicFiles.mockClear();

    rerender({ tab: DialFileManagerTabs.Organization });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.path).toBe('/My files');
    expect(mockListPublicFiles).toHaveBeenCalled();
  });

  describe('onSearchFiles', () => {
    it('debounces search and calls listFiles only once after 300ms', async () => {
      mockListFiles.mockResolvedValue({
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
      const initialCallCount = mockListFiles.mock.calls.length;

      vi.useFakeTimers();
      try {
        act(() => result.current.onSearchFiles('/', 'rep'));
        act(() => result.current.onSearchFiles('/', 'repo'));
        act(() => result.current.onSearchFiles('/', 'repor'));

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount);

        act(() => {
          vi.advanceTimersByTime(300);
        });
        await act(() => Promise.resolve());

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount + 1);
        const lastCall =
          mockListFiles.mock.calls[mockListFiles.mock.calls.length - 1][0];
        expect(lastCall).toMatchObject({ recursive: true });
        expect(result.current.searchResults).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels in-flight search when a second query arrives before the first resolves', async () => {
      const { result } = renderListing();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const initialCallCount = mockListFiles.mock.calls.length;

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
      mockListFiles.mockReturnValueOnce(firstPromise).mockResolvedValue({
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

        expect(mockListFiles).toHaveBeenCalledTimes(initialCallCount + 2);
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
      mockListFiles.mockResolvedValue({
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
      mockListSharedFiles.mockResolvedValue({
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
      mockListSharedFiles.mockResolvedValue({
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
      mockListSharedByMe.mockResolvedValue({
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
      expect(mockListSharedByMe).not.toHaveBeenCalled();
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
