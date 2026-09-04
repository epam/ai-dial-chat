import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useMemo } from 'react';

/** Cache entries older than this are treated as a miss, even if the seed still matches. */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** A cached MCP App resource fetch plus its resolved tool result. */
export interface CachedMcpAppResponse {
  html: string;
  toolResult?: CallToolResult;
}

interface CacheEntry extends CachedMcpAppResponse {
  /** `computeMcpAppSeedKey`'s value for the seed this entry was resolved from — see `get`. */
  seedKey: string | undefined;
  cachedAt: number;
}

/** Reads/writes `useMcpAppResponseCache`'s per-conversation cache. */
export interface McpAppResponseCache {
  /**
   * Returns the cached entry only if it was written for this exact
   * `seedKey` (`computeMcpAppSeedKey`) and is younger than 15 minutes;
   * otherwise `undefined` (a miss), so a stale or seed-mismatched entry is
   * never served.
   */
  get: (key: string, seedKey: string | undefined) => CachedMcpAppResponse | undefined;
  set: (
    key: string,
    value: CachedMcpAppResponse,
    seedKey: string | undefined,
  ) => void;
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
 *
 * Each entry is tagged with the `seedKey` (`computeMcpAppSeedKey`) it was
 * resolved from and a 15-minute TTL: a freshly-streamed message mounts the
 * preview before `custom_content.state` carries a real tool call, so the
 * first write happens with an undefined seed. `get` treats a later, settled
 * seed as a miss rather than reusing that earlier, seedless entry — without
 * this, D10's live tool re-call would never run once the message settled.
 */
export const useMcpAppResponseCache = (
  conversationId: string,
): McpAppResponseCache => {
  /*
   * A plain `useMemo`-keyed `Map`, not a `useRef` reset during render — this
   * repo's `react-hooks/refs` lint rule disallows reading/writing `.current`
   * during render, and recreating the `Map` here (a new value, not a ref
   * mutation) is what `useMemo` exists for.
   */
  const map = useMemo(
    () => new Map<string, CacheEntry>(),
    [conversationId],
  );

  return useMemo<McpAppResponseCache>(
    () => ({
      get: (key, seedKey) => {
        const entry = map.get(key);
        if (entry == null) return undefined;
        if (entry.seedKey !== seedKey) return undefined;
        if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
        return { html: entry.html, toolResult: entry.toolResult };
      },
      set: (key, value, seedKey) => {
        map.set(key, { ...value, seedKey, cachedAt: Date.now() });
      },
      invalidate: (key) => {
        map.delete(key);
      },
    }),
    [map],
  );
};
