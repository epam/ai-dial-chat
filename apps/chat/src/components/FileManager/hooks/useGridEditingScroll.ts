import { useCallback, useMemo, useRef, useState } from 'react';

import { FileManagerGridRow } from '@epam/ai-dial-ui-kit';
import {
  CellEditingStartedEvent,
  GridApi,
  GridOptions,
  IRowNode,
  RowDataUpdatedEvent,
} from 'ag-grid-community';

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

const useFreeze = (frozen: boolean) => {
  const lastUnfrozenValueRef = useRef<unknown>(undefined);
  return useCallback(
    <T>(value: T): T => {
      if (!frozen) {
        lastUnfrozenValueRef.current = value;
      }
      return lastUnfrozenValueRef.current as T;
    },
    [frozen],
  );
};

export const useGridEditingScroll = ({
  resolveTargetNode = defaultResolveTargetNode,
}: UseGridEditingScrollOptions = {}) => {
  const [isEditing, setIsEditing] = useState(false);
  const knownRowIdsRef = useRef<Set<string>>(new Set());
  const knownRowIdsInitializedRef = useRef(false);

  const reset = useCallback(() => {
    knownRowIdsRef.current = new Set();
    knownRowIdsInitializedRef.current = false;
    setIsEditing(false);
  }, []);

  const freezeItems = useFreeze(isEditing);

  const additionalGridOptions = useMemo<GridOptions<FileManagerGridRow>>(
    () => ({
      suppressRowVirtualisation: true,
      onCellEditingStarted: (params: CellEditingStartedEvent) => {
        setIsEditing(true);
        if (params.api && params.rowIndex != null) {
          setTimeout(() => params.api.ensureIndexVisible(params.rowIndex!), 0);
        }
      },
      onCellEditingStopped: () => setIsEditing(false),
      onRowDataUpdated: (params: RowDataUpdatedEvent) => {
        const currentIds = new Set<string>();
        const newNodes: IRowNode<FileManagerGridRow>[] = [];

        params.api.forEachNode((node) => {
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
          scrollRowIntoView(params.api, targetNode);
        }
      },
    }),
    [resolveTargetNode],
  );

  return { isEditing, freezeItems, additionalGridOptions, reset };
};
