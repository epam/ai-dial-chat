import {
  DestinationFolderMode,
  DialFileNodeType,
  DialFilePermission,
  type DialDestinationRequest,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationRestriction } from '../../dial-file-manager-destination.util';
import {
  useFileManagerDestination,
  type UseFileManagerDestinationParams,
} from '../useFileManagerDestination';

const folder = (name: string, path: string, items: DialFile[] = []): DialFile =>
  ({
    id: path,
    name,
    path,
    nodeType: DialFileNodeType.FOLDER,
    items,
    permissions: [DialFilePermission.WRITE],
  }) as DialFile;

const items: DialFile[] = [
  folder('My files', '/My files', [
    folder('reports', '/My files/reports', [
      folder('2024', '/My files/reports/2024'),
    ]),
    folder('archive', '/My files/archive'),
  ]),
];

const request = (
  overrides: Partial<DialDestinationRequest> = {},
): DialDestinationRequest => ({
  mode: DestinationFolderMode.Copy,
  items: [
    {
      id: '/My files/reports/a.pdf',
      name: 'a.pdf',
      path: '/My files/reports/a.pdf',
      nodeType: DialFileNodeType.ITEM,
    } as DialFile,
  ],
  sourceFolder: '/My files/reports',
  confirm: vi.fn(),
  cancel: vi.fn(),
  ...overrides,
});

const onPreloadFolder = vi.fn();
const onCreateFolder = vi.fn().mockResolvedValue(undefined);

const renderDestination = (
  params: Partial<UseFileManagerDestinationParams> = {},
) =>
  renderHook(() =>
    useFileManagerDestination({
      request: request(),
      items,
      loadingPaths: new Set(),
      onPreloadFolder,
      onCreateFolder,
      ...params,
    }),
  );

describe('useFileManagerDestination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts on the folder the items are in and preloads it', () => {
    const { result } = renderDestination();

    expect(result.current.destination).toEqual({
      rootKey: 'My files',
      path: ['reports'],
    });
    expect(result.current.destinationVirtualPath).toBe('/My files/reports');
    expect(onPreloadFolder).toHaveBeenCalledWith('/My files/reports');
  });

  it('opens on the source folder once the items arrive after the request', () => {
    const sourceRequest = request();
    const { result, rerender } = renderHook(
      ({ current }: { current: DialFile[] }) =>
        useFileManagerDestination({
          request: sourceRequest,
          items: current,
          loadingPaths: new Set(),
          onPreloadFolder,
          onCreateFolder,
        }),
      { initialProps: { current: [] as DialFile[] } },
    );
    expect(result.current.destinationVirtualPath).toBeUndefined();

    rerender({ current: items });

    expect(result.current.destination).toEqual({
      rootKey: 'My files',
      path: ['reports'],
    });
    expect(result.current.roots[0]?.expandedPaths).toEqual(
      new Set(['reports']),
    );
    expect(onPreloadFolder).toHaveBeenCalledWith('/My files/reports');
  });

  it('opens the hierarchy along the path to the source folder', () => {
    const { result } = renderDestination({
      request: request({ sourceFolder: '/My files/reports/2024' }),
    });

    expect(result.current.roots[0]?.expandedPaths).toEqual(
      new Set(['reports', 'reports/2024']),
    );
  });

  it('falls back to the first root when the source folder is outside every root', () => {
    const { result } = renderDestination({
      request: request({ sourceFolder: '/Elsewhere' }),
    });

    expect(result.current.destination).toEqual({
      rootKey: 'My files',
      path: [],
    });
  });

  it('restricts the folder the items are already in', () => {
    const { result } = renderDestination();

    expect(result.current.restriction).toBe(
      DestinationRestriction.SourceFolder,
    );
  });

  it('allows another folder once it is picked', () => {
    const { result } = renderDestination();

    act(() => {
      result.current.onDestinationChange({
        rootKey: 'My files',
        path: ['archive'],
      });
    });

    expect(result.current.destinationVirtualPath).toBe('/My files/archive');
    expect(result.current.restriction).toBeUndefined();
  });

  it('reports a destination whose folder is still loading', () => {
    const { result } = renderDestination({
      loadingPaths: new Set(['/My files/reports']),
    });

    expect(result.current.isDestinationLoading).toBe(true);
  });

  it('preloads a folder when it is picked', () => {
    const { result } = renderDestination();
    onPreloadFolder.mockClear();

    act(() => {
      result.current.onDestinationChange({
        rootKey: 'My files',
        path: ['archive'],
      });
    });

    expect(onPreloadFolder).toHaveBeenCalledWith('/My files/archive');
  });

  it('preloads a folder when it is expanded in the tree', () => {
    const { result } = renderDestination();
    onPreloadFolder.mockClear();

    act(() => {
      result.current.roots[0]?.onExpandedPathsChange?.(
        new Set(['reports', 'archive']),
      );
    });

    expect(onPreloadFolder).toHaveBeenCalledWith('/My files/archive');
    expect(result.current.roots[0]?.expandedPaths).toEqual(
      new Set(['reports', 'archive']),
    );
  });

  it('creates a folder under the chosen parent through the marker convention', async () => {
    const { result } = renderDestination();

    await act(async () => {
      await result.current.onCreateFolder('My files', ['reports'], 'new');
    });

    expect(onCreateFolder).toHaveBeenCalledWith(
      expect.objectContaining({ name: '.dial_folder' }),
      '/My files/reports/new',
      '',
    );
  });
});
