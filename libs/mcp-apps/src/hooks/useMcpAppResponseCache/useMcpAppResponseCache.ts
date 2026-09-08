import { useMemo, useRef } from 'react';
import type {
  CachedMcpAppResponse,
  McpAppResponseCache,
} from '../../models/mcp-apps';

/** Cache entries older than this are treated as a miss, even if the seed still matches. */
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry extends CachedMcpAppResponse {
  /** `computeMcpAppSeedKey`'s value for the seed this entry was resolved from — see `get`. */
  seedKey: string | undefined;
  cachedAt: number;
}

/**
 * In-memory cache of a fetched MCP App resource + its resolved tool result,
 * keyed by a caller-supplied `key` (e.g. `mcpAppCanvasKey(messageIndex)`),
 * scoped to one open conversation. Lets an inline preview and a full-width
 * canvas reuse the same fetch/live-tool-re-call for the same message instead
 * of repeating it every time the user switches between the two.
 *
 * Each entry is tagged with the `seedKey` (`computeMcpAppSeedKey`) it was
 * resolved from and a 15-minute TTL: a freshly-streamed message mounts the
 * preview before the tool call is known, so the first write happens with an
 * undefined seed. `get` treats a later, settled seed as a miss rather than
 * reusing that earlier, seedless entry.
 *
 * The underlying `Map`s (entries, and `getOrFetch`'s in-flight promises)
 * live in `useRef`s, mutated only inside `get`/`set`/`invalidate`/`getOrFetch`
 * — functions called later by consumers (in an effect or event handler),
 * never during this hook's own render — so no ref is read or written while
 * rendering. Entries are namespaced by `conversationId`
 * (`${conversationId}:${key}`) rather than clearing the map on conversation
 * switch, since clearing would itself require touching the ref during
 * render; `set` opportunistically prunes expired entries instead, keeping
 * the map bounded without a per-conversation reset.
 */
export const useMcpAppResponseCache = (
  conversationId: string,
): McpAppResponseCache => {
  const mapRef = useRef<Map<string, CacheEntry>>(new Map());
  const pendingRef = useRef<Map<string, Promise<CachedMcpAppResponse>>>(
    new Map(),
  );

  return useMemo<McpAppResponseCache>(() => {
    const namespacedKey = (key: string) => `${conversationId}:${key}`;
    const pendingKey = (key: string, seedKey: string | undefined) =>
      `${namespacedKey(key)}::${seedKey ?? ''}`;

    const get: McpAppResponseCache['get'] = (key, seedKey) => {
      const entry = mapRef.current.get(namespacedKey(key));
      if (entry == null) return undefined;
      if (entry.seedKey !== seedKey) return undefined;
      if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return undefined;
      return { html: entry.html, toolResult: entry.toolResult };
    };

    const set: McpAppResponseCache['set'] = (key, value, seedKey) => {
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
    };

    return {
      get,
      set,
      invalidate: (key) => {
        mapRef.current.delete(namespacedKey(key));
        const prefix = `${namespacedKey(key)}::`;
        for (const existingPendingKey of pendingRef.current.keys()) {
          if (existingPendingKey.startsWith(prefix)) {
            pendingRef.current.delete(existingPendingKey);
          }
        }
      },
      getOrFetch: (key, seedKey, fetchFn) => {
        const cached = get(key, seedKey);
        if (cached) return Promise.resolve(cached);

        const pKey = pendingKey(key, seedKey);
        let pending = pendingRef.current.get(pKey);
        if (!pending) {
          pending = fetchFn().then((result) => {
            set(key, result, seedKey);
            return result;
          });
          pendingRef.current.set(pKey, pending);
          /*
           * Chained on `pending` itself (not a separate `.catch`/`.then`), so
           * this runs only after the `set()` above has already happened on
           * success — closing the window between "fetch settled" and "cache
           * updated" during which a call arriving right then would find
           * neither the cache entry nor the (already-deleted) pending
           * promise and start a third, redundant fetch.
           */
          pending.finally(() => {
            pendingRef.current.delete(pKey);
          });
        }
        return pending;
      },
    };
  }, [conversationId]);
};
