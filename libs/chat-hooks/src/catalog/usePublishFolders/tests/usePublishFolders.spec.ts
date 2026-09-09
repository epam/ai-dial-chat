import {
  ListFilesItemDtoNodeTypeEnum,
  type ListFilesItemDto,
  type ListFilesResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePublishFolders,
  type UsePublishFoldersParams,
} from '../usePublishFolders';

const makeFolder = (
  name: string,
  parentPath = '',
  bucket = 'public',
): ListFilesItemDto => ({
  name,
  path: `${parentPath}${name}/`,
  folderId: `${bucket}/${parentPath}${name}/`,
  nodeType: ListFilesItemDtoNodeTypeEnum.Folder,
  bucket,
  parentPath: parentPath || undefined,
});

const makeFile = (name: string, bucket = 'public'): ListFilesItemDto => ({
  name,
  path: name,
  folderId: `${bucket}/`,
  nodeType: ListFilesItemDtoNodeTypeEnum.Item,
  bucket,
});

const response = (items: ListFilesItemDto[]): ListFilesResponseDto =>
  ({ items }) as ListFilesResponseDto;

describe('usePublishFolders', () => {
  let listPublicFiles: UsePublishFoldersParams['listPublicFiles'];

  beforeEach(() => {
    vi.clearAllMocks();
    listPublicFiles = vi.fn(async ({ path }: { path?: string }) => {
      if (path == null) return response([makeFolder('Org'), makeFile('a.txt')]);
      if (path === 'Org/') return response([makeFolder('Shared', 'Org/')]);
      return response([]);
    });
  });

  const render = (overrides: Partial<UsePublishFoldersParams> = {}) =>
    renderHook(() => usePublishFolders({ listPublicFiles, ...overrides }));

  it('lists the public bucket root on mount and keeps only folders', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));
    expect(listPublicFiles).toHaveBeenCalledWith({ path: undefined });
    expect(result.current.folderItems[0]).toMatchObject({
      name: 'Org',
      path: ['Org'],
    });
  });

  it('fetches a folder the first time it is expanded and caches it after', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['Org']));
    });

    await waitFor(() =>
      expect(
        result.current.folderItems[0].children?.map((child) => child.name),
      ).toEqual(['Shared']),
    );
    expect(listPublicFiles).toHaveBeenCalledWith({ path: 'Org/' });
    expect(result.current.loadedPaths.has('Org')).toBe(true);

    act(() => {
      result.current.onExpandedPathsChange(new Set(['Org']));
    });

    /* Root plus one child listing — the second expand is served from cache. */
    expect(listPublicFiles).toHaveBeenCalledTimes(2);
  });

  it('merges remembered destinations into the tree', async () => {
    const { result } = render({ rememberedFolderKeys: ['Org/Archive'] });

    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));
    expect(
      result.current.folderItems[0].children?.map((child) => child.name),
    ).toContain('Archive');
  });

  it('reports a newly used destination through the change callback', async () => {
    const onRememberedFolderKeysChange = vi.fn();
    const { result } = render({
      rememberedFolderKeys: ['Org/Archive'],
      onRememberedFolderKeysChange,
    });
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.rememberPublishFolder(['Org', 'Shared']);
    });

    expect(onRememberedFolderKeysChange).toHaveBeenCalledWith([
      'Org/Shared',
      'Org/Archive',
    ]);
  });

  it('does not re-report a destination that is already remembered', async () => {
    const onRememberedFolderKeysChange = vi.fn();
    const { result } = render({
      rememberedFolderKeys: ['Org/Shared'],
      onRememberedFolderKeysChange,
    });
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.rememberPublishFolder(['Org', 'Shared']);
    });

    expect(onRememberedFolderKeysChange).not.toHaveBeenCalled();
  });

  it('caps the remembered list, dropping the oldest destination', async () => {
    const onRememberedFolderKeysChange = vi.fn();
    const existing = Array.from({ length: 50 }, (_, i) => `Org/Folder${i}`);
    const { result } = render({
      rememberedFolderKeys: existing,
      onRememberedFolderKeysChange,
    });
    await waitFor(() =>
      expect(result.current.folderItems.length).toBeGreaterThan(0),
    );

    act(() => {
      result.current.rememberPublishFolder(['Org', 'Newest']);
    });

    const next = onRememberedFolderKeysChange.mock.calls[0][0] as string[];
    expect(next).toHaveLength(50);
    expect(next[0]).toBe('Org/Newest');
    expect(next).not.toContain('Org/Folder49');
  });

  it('adds a created folder to the tree without calling the backend', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));
    const callsBefore = vi.mocked(listPublicFiles).mock.calls.length;

    await act(async () => {
      await result.current.onCreatePublishFolder([], 'Drafts');
    });

    expect(result.current.folderItems.map((item) => item.name)).toContain(
      'Drafts',
    );
    expect(vi.mocked(listPublicFiles).mock.calls).toHaveLength(callsBefore);
  });

  /*
   * Issue #8568: "Add child" on a folder the user had not expanded yet also
   * expands it, which starts that folder's listing. The created folder used
   * to live in the same listing cache, so the listing landing afterwards
   * replaced it and the new folder vanished — while folders higher up in the
   * hierarchy, already listed during navigation, kept theirs.
   */
  it('keeps a folder created under a not-yet-listed folder when that listing lands', async () => {
    let releaseChildListing: (() => void) | undefined;
    const { result } = render({
      listPublicFiles: async ({ path }: { path?: string }) => {
        if (path == null) return response([makeFolder('Org')]);
        if (path === 'Org/') {
          await new Promise<void>((resolve) => {
            releaseChildListing = resolve;
          });
        }
        return response([]);
      },
    });
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    act(() => {
      result.current.onExpandedPathsChange(new Set(['Org']));
    });
    await act(async () => {
      await result.current.onCreatePublishFolder(['Org'], 'Drafts');
    });
    expect(
      result.current.folderItems[0].children?.map((child) => child.name),
    ).toEqual(['Drafts']);

    await act(async () => {
      releaseChildListing?.();
    });

    expect(
      result.current.folderItems[0].children?.map((child) => child.name),
    ).toEqual(['Drafts']);
  });

  it('denies write access under a restricted folder segment', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));

    expect(result.current.hasPublishWriteAccess(['Org', 'Shared'])).toBe(true);
    expect(result.current.hasPublishWriteAccess(['Org', 'Production'])).toBe(
      false,
    );
  });

  it('tolerates a malformed stored value instead of throwing', async () => {
    const { result } = render({
      rememberedFolderKeys: [42, 'Org/Archive'] as unknown as string[],
    });

    await waitFor(() => expect(result.current.folderItems).toHaveLength(1));
    expect(
      result.current.folderItems[0].children?.map((child) => child.name),
    ).toContain('Archive');
  });
});
