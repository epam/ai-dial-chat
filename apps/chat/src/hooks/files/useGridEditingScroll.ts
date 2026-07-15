import { FileManagerGridRow } from '@epam/ai-dial-ui-kit';
import {
  CellEditingStartedEvent,
  GridApi,
  IRowNode,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { useCallback, useEffect, useRef } from 'react';

const findRowElement = (
  node: IRowNode<FileManagerGridRow>,
): HTMLElement | null => {
  if (node.id) {
    const byId = document.querySelector<HTMLElement>(`[row-id="${node.id}"]`);
    if (byId) return byId;
  }
  if (node.rowIndex != null) {
    return document.querySelector<HTMLElement>(
      `[row-index="${node.rowIndex}"]`,
    );
  }
  return null;
};

const scrollRowIntoView = (
  api: GridApi<FileManagerGridRow>,
  node: IRowNode<FileManagerGridRow>,
): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!api.isDestroyed() && node.rowIndex != null) {
        api.ensureNodeVisible(node, 'middle');
      }
      findRowElement(node)?.scrollIntoView({
        block: 'center',
        behavior: 'auto',
      });
    });
  });
};

export interface UseGridEditingScrollOptions {
  resolveTargetNode?: (
    newNodes: IRowNode<FileManagerGridRow>[],
  ) => IRowNode<FileManagerGridRow> | null;
}

const defaultResolveTargetNode = (
  newNodes: IRowNode<FileManagerGridRow>[],
): IRowNode<FileManagerGridRow> | null =>
  newNodes.find((node) => node.data?.isTemporary) ?? newNodes[0] ?? null;

/**
 * `@epam/ai-dial-ui-kit`'s `GridOptions` type does not forward raw AG Grid
 * event callbacks (`onCellEditingStarted`/`onRowDataUpdated`), so this hook
 * binds directly to the `GridApi` obtained via `DialFileManager`'s
 * `onGridApiChange` prop and uses AG Grid's own `addEventListener` instead of
 * a `gridOptions` fragment.
 */
export const useGridEditingScroll = ({
  resolveTargetNode = defaultResolveTargetNode,
}: UseGridEditingScrollOptions = {}) => {
  const knownRowIdsRef = useRef<Set<string>>(new Set());
  const knownRowIdsInitializedRef = useRef(false);
  const subscribedApiRef = useRef<GridApi<FileManagerGridRow> | null>(null);

  const reset = useCallback(() => {
    knownRowIdsRef.current = new Set();
    knownRowIdsInitializedRef.current = false;
  }, []);

  const handleCellEditingStarted = useCallback(
    (event: CellEditingStartedEvent<FileManagerGridRow>) => {
      const { api } = event;
      if (!api.isDestroyed() && event.rowIndex != null) {
        api.ensureIndexVisible(event.rowIndex);
      }
    },
    [],
  );

  const handleRowDataUpdated = useCallback(
    (event: RowDataUpdatedEvent<FileManagerGridRow>) => {
      const { api } = event;
      const currentIds = new Set<string>();
      const newNodes: IRowNode<FileManagerGridRow>[] = [];

      api.forEachNode((node) => {
        const id = node.data?.id;
        if (!id) return;
        currentIds.add(id);
        if (
          knownRowIdsInitializedRef.current &&
          !knownRowIdsRef.current.has(id)
        ) {
          newNodes.push(node);
        }
      });

      knownRowIdsRef.current = currentIds;
      knownRowIdsInitializedRef.current = true;

      const targetNode = resolveTargetNode(newNodes);
      if (targetNode) {
        scrollRowIntoView(api, targetNode);
      }
    },
    [resolveTargetNode],
  );

  const handleGridApiChange = useCallback(
    (api: GridApi<FileManagerGridRow>) => {
      const previousApi = subscribedApiRef.current;
      if (previousApi === api) return;

      if (previousApi != null) {
        previousApi.removeEventListener(
          'cellEditingStarted',
          handleCellEditingStarted,
        );
        previousApi.removeEventListener('rowDataUpdated', handleRowDataUpdated);
      }

      api.addEventListener('cellEditingStarted', handleCellEditingStarted);
      api.addEventListener('rowDataUpdated', handleRowDataUpdated);
      subscribedApiRef.current = api;
    },
    [handleCellEditingStarted, handleRowDataUpdated],
  );

  useEffect(() => {
    return () => {
      const api = subscribedApiRef.current;
      if (api != null && !api.isDestroyed()) {
        api.removeEventListener('cellEditingStarted', handleCellEditingStarted);
        api.removeEventListener('rowDataUpdated', handleRowDataUpdated);
      }
      subscribedApiRef.current = null;
    };
  }, [handleCellEditingStarted, handleRowDataUpdated]);

  return { handleGridApiChange, reset };
};
