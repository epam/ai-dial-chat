import { FileManagerGridRow } from '@epam/ai-dial-ui-kit';
import { act, renderHook } from '@testing-library/react';
import type {
  CellEditingStartedEvent,
  GridApi,
  IRowNode,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGridEditingScroll } from '../useGridEditingScroll';

interface MockNode {
  id: string;
  rowIndex: number;
  data: Partial<FileManagerGridRow>;
}

const createMockApi = (
  nodes: MockNode[],
): GridApi<FileManagerGridRow> & {
  listeners: Record<string, ((event: unknown) => void)[]>;
} => {
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const isDestroyedRef = { current: false };

  const api = {
    listeners,
    isDestroyed: vi.fn(() => isDestroyedRef.current),
    ensureIndexVisible: vi.fn(),
    ensureNodeVisible: vi.fn(),
    forEachNode: vi.fn(
      (callback: (node: IRowNode<FileManagerGridRow>) => void) => {
        nodes.forEach((node) =>
          callback(node as unknown as IRowNode<FileManagerGridRow>),
        );
      },
    ),
    addEventListener: vi.fn(
      (type: string, listener: (event: unknown) => void) => {
        listeners[type] = [...(listeners[type] ?? []), listener];
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: unknown) => void) => {
        listeners[type] = (listeners[type] ?? []).filter(
          (existing) => existing !== listener,
        );
      },
    ),
  } as unknown as GridApi<FileManagerGridRow> & {
    listeners: Record<string, ((event: unknown) => void)[]>;
  };

  return api;
};

const emitCellEditingStarted = (
  api: GridApi<FileManagerGridRow> & {
    listeners: Record<string, ((event: unknown) => void)[]>;
  },
  rowIndex: number | null,
): void => {
  const event = {
    api,
    rowIndex,
  } as unknown as CellEditingStartedEvent<FileManagerGridRow>;
  api.listeners['cellEditingStarted']?.forEach((listener) => listener(event));
};

const emitRowDataUpdated = (
  api: GridApi<FileManagerGridRow> & {
    listeners: Record<string, ((event: unknown) => void)[]>;
  },
): void => {
  const event = { api } as unknown as RowDataUpdatedEvent<FileManagerGridRow>;
  api.listeners['rowDataUpdated']?.forEach((listener) => listener(event));
};

describe('useGridEditingScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(document, 'querySelector').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('calls ensureIndexVisible with the row index when inline rename starts', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitCellEditingStarted(api, 3);

    expect(api.ensureIndexVisible).toHaveBeenCalledWith(3);
  });

  it('does not call ensureIndexVisible when the grid api is destroyed', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([]);
    vi.mocked(api.isDestroyed).mockReturnValue(true);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitCellEditingStarted(api, 3);

    expect(api.ensureIndexVisible).not.toHaveBeenCalled();
  });

  it('seeds known row ids on the first rowDataUpdated after mount without scrolling', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([
      { id: 'a', rowIndex: 0, data: { id: 'a' } },
      { id: 'b', rowIndex: 1, data: { id: 'b' } },
    ]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitRowDataUpdated(api);

    expect(api.ensureNodeVisible).not.toHaveBeenCalled();
  });

  it('scrolls the temporary new-folder row into view when a new row appears', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([{ id: 'a', rowIndex: 0, data: { id: 'a' } }]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitRowDataUpdated(api);

    const newNode = {
      id: 'new',
      rowIndex: 1,
      data: { id: 'new', isTemporary: true },
    };
    api.forEachNode = vi.fn((callback) => {
      [{ id: 'a', rowIndex: 0, data: { id: 'a' } }, newNode].forEach((node) =>
        callback(node as unknown as IRowNode<FileManagerGridRow>),
      );
    });
    emitRowDataUpdated(api);

    expect(api.ensureNodeVisible).toHaveBeenCalledWith(newNode, 'middle');
  });

  it('does not scroll when rowDataUpdated introduces no new row ids', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([{ id: 'a', rowIndex: 0, data: { id: 'a' } }]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitRowDataUpdated(api);
    emitRowDataUpdated(api);

    expect(api.ensureNodeVisible).not.toHaveBeenCalled();
  });

  it('removes listeners from the previous grid api when a new api instance is passed', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const firstApi = createMockApi([]);
    const secondApi = createMockApi([]);

    act(() => {
      result.current.handleGridApiChange(firstApi);
    });
    act(() => {
      result.current.handleGridApiChange(secondApi);
    });

    expect(firstApi.removeEventListener).toHaveBeenCalledWith(
      'cellEditingStarted',
      expect.any(Function),
    );
    expect(firstApi.removeEventListener).toHaveBeenCalledWith(
      'rowDataUpdated',
      expect.any(Function),
    );
    expect(secondApi.addEventListener).toHaveBeenCalledWith(
      'cellEditingStarted',
      expect.any(Function),
    );
    expect(secondApi.addEventListener).toHaveBeenCalledWith(
      'rowDataUpdated',
      expect.any(Function),
    );
  });

  it('removes listeners from the subscribed api when the hook unmounts', () => {
    const { result, unmount } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    unmount();

    expect(api.removeEventListener).toHaveBeenCalledWith(
      'cellEditingStarted',
      expect.any(Function),
    );
    expect(api.removeEventListener).toHaveBeenCalledWith(
      'rowDataUpdated',
      expect.any(Function),
    );
  });

  it('does not attach duplicate listeners when the same api instance is passed twice', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    act(() => {
      result.current.handleGridApiChange(api);
    });

    expect(api.addEventListener).toHaveBeenCalledTimes(2);
    expect(api.listeners['cellEditingStarted']).toHaveLength(1);
    expect(api.listeners['rowDataUpdated']).toHaveLength(1);
  });

  it('treats the first rowDataUpdated after reset() as a fresh seed with no scroll', () => {
    const { result } = renderHook(() => useGridEditingScroll());
    const api = createMockApi([{ id: 'a', rowIndex: 0, data: { id: 'a' } }]);

    act(() => {
      result.current.handleGridApiChange(api);
    });
    emitRowDataUpdated(api);

    act(() => {
      result.current.reset();
    });

    const newNode = { id: 'b', rowIndex: 1, data: { id: 'b' } };
    api.forEachNode = vi.fn((callback) => {
      [{ id: 'a', rowIndex: 0, data: { id: 'a' } }, newNode].forEach((node) =>
        callback(node as unknown as IRowNode<FileManagerGridRow>),
      );
    });
    emitRowDataUpdated(api);

    expect(api.ensureNodeVisible).not.toHaveBeenCalled();
  });
});
