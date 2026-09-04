import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useMemo, useRef } from 'react';

/** A cached MCP App resource fetch plus its resolved tool result. */
export interface CachedMcpAppResponse {
  html: string;
  toolResult?: CallToolResult;
}

/** Reads/writes `useMcpAppResponseCache`'s per-conversation cache. */
export interface McpAppResponseCache {
  get: (key: string) => CachedMcpAppResponse | undefined;
  set: (key: string, value: CachedMcpAppResponse) => void;
  invalidate: (key: string) => void;
}

/**
 * In-memory cache of a fetched MCP App resource + its resolved tool result,
 * keyed by `mcpAppCanvasKey(messageIndex)`, scoped to one open conversation.
 * Lets the inline preview (`useMcpAppInlinePreview`) and the full-width
 * canvas (`useOpenMcpAppCanvas`) reuse the same fetch/live-tool-re-call for
 * the same message instead of repeating it every time the user switches
 * between the two. Switching to a different conversation (`conversationId`
 * changes) starts a fresh, empty cache rather than serving another
 * conversation's stale entries.
 */
export const useMcpAppResponseCache = (
  conversationId: string,
): McpAppResponseCache => {
  const stateRef = useRef<{
    conversationId: string;
    map: Map<string, CachedMcpAppResponse>;
  } | null>(null);
  if (stateRef.current?.conversationId !== conversationId) {
    stateRef.current = { conversationId, map: new Map() };
  }

  return useMemo<McpAppResponseCache>(
    () => ({
      get: (key) => stateRef.current?.map.get(key),
      set: (key, value) => {
        stateRef.current?.map.set(key, value);
      },
      invalidate: (key) => {
        stateRef.current?.map.delete(key);
      },
    }),
    [],
  );
};
