import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useMemo, useRef } from 'react';

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
  get: (
    key: string,
    seedKey: string | undefined,
  ) => CachedMcpAppResponse | undefined;
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
 * between the two.
 *
 * Each entry is tagged with the `seedKey` (`computeMcpAppSeedKey`) it was
 * resolved from and a 15-minute TTL: a freshly-streamed message mounts the
 * preview before `custom_content.state` carries a real tool call, so the
 * first write happens with an undefined seed. `get` treats a later, settled
 * seed as a miss rather than reusing that earlier, seedless entry — without
 * this, D10's live tool re-call would never run once the message settled.
 *
 * The underlying `Map` lives in a `useRef`, mutated only inside `get`/`set`/
 * `invalidate` — functions called later by consumers (in an effect or event
 * handler), never during this hook's own render — so no ref is read or
 * written while rendering. Entries are namespaced by `conversationId`
 * (`${conversationId}:${key}`) rather than clearing the map on conversation
 * switch, since clearing would itself require touching the ref during
 * render; `set` opportunistically prunes expired entries instead, keeping
 * the map bounded without a per-conversation reset.
 */
export const useMcpAppResponseCache = (
  conversationId: string,
): McpAppResponseCache => {
  const mapRef = useRef<Map<string, CacheEntry>>(new Map());

  return useMemo<McpAppResponseCache>(() => {
    const namespacedKey = (key: string) => `${conversationId}:${key}`;

    return {
      get: (key, seedKey) => {
        const entry = mapRef.current.get(namespacedKey(key));
        if (entry == null) return undefined;
        if (entry.seedKey !== seedKey) return undefined;
        if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
        return { html: entry.html, toolResult: entry.toolResult };
      },
      set: (key, value, seedKey) => {
        const now = Date.now();
        for (const [existingKey, existingEntry] of mapRef.current) {
          if (now - existingEntry.cachedAt > CACHE_TTL_MS) {
            mapRef.current.delete(existingKey);
          }
        }
        mapRef.current.set(namespacedKey(key), {
          ...value,
          seedKey,
          cachedAt: now,
        });
      },
      invalidate: (key) => {
        mapRef.current.delete(namespacedKey(key));
      },
    };
  }, [conversationId]);
};
