import type { ResourceFoldersResponseDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResourceFolders } from '../useResourceFolders';

const listing = (...paths: string[]): ResourceFoldersResponseDto => ({
  folders: paths.map((path) => ({
    path,
    name: path.split('/').pop() ?? path,
  })),
});

describe('useResourceFolders', () => {
  let listFolders: ReturnType<
    typeof vi.fn<(path: string) => Promise<ResourceFoldersResponseDto>>
  >;

  beforeEach(() => {
    listFolders = vi.fn((path: string) =>
      Promise.resolve(
        path === '' ? listing('Design', 'Sales') : listing(`${path}/Audit`),
      ),
    );
  });

  it('loads the root folders once enabled', async () => {
    const { result } = renderHook(() => useResourceFolders({ listFolders }));

    await waitFor(() =>
      expect(result.current.folderItems.map((node) => node.name)).toEqual([
        'Design',
        'Sales',
      ]),
    );
    expect(listFolders).toHaveBeenCalledWith('');
  });

  it('waits to load until enabled', async () => {
    const { rerender, result } = renderHook(
      ({ isEnabled }) => useResourceFolders({ listFolders, isEnabled }),
      { initialProps: { isEnabled: false } },
    );
    expect(listFolders).not.toHaveBeenCalled();

    rerender({ isEnabled: true });

    await waitFor(() => expect(result.current.folderItems).toHaveLength(2));
    expect(listFolders).toHaveBeenCalledOnce();
  });

  it('fetches a folder when it is expanded and nests its children', async () => {
    const { result } = renderHook(() => useResourceFolders({ listFolders }));
    await waitFor(() => expect(result.current.folderItems).toHaveLength(2));

    act(() => result.current.onExpandedPathsChange(new Set(['Design'])));

    await waitFor(() =>
      expect(
        result.current.folderItems
          .find((node) => node.name === 'Design')
          ?.children?.map((node) => node.path),
      ).toEqual([['Design', 'Audit']]),
    );
    expect(listFolders).toHaveBeenCalledWith('Design');
    expect(result.current.expandedPaths).toEqual(new Set(['Design']));
  });

  it('keeps a locally created folder after the parent listing arrives', async () => {
    const { result } = renderHook(() => useResourceFolders({ listFolders }));
    await waitFor(() => expect(result.current.folderItems).toHaveLength(2));

    await act(() => result.current.onCreateFolder(['Design'], 'Reviews'));
    act(() => result.current.onExpandedPathsChange(new Set(['Design'])));

    await waitFor(() =>
      expect(
        result.current.folderItems
          .find((node) => node.name === 'Design')
          ?.children?.map((node) => node.name),
      ).toEqual(['Audit', 'Reviews']),
    );
  });

  it('reports a failed listing and retries it', async () => {
    listFolders.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useResourceFolders({ listFolders }));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.folderItems).toEqual([]);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.hasError).toBe(false));
    expect(result.current.folderItems).toHaveLength(2);
  });
});
