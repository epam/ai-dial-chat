import {
  AttachmentContentType,
  type McpAppCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useState } from 'react';
import {
  McpAppInlinePreviewStatus,
  type McpAppHostAdapter,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '../../models/mcp-apps';
import {
  computeMcpAppSeedKey,
  resolveMcpAppToolResult,
} from '../../utils/mcp-app';

/** State returned by `useMcpAppInlinePreview`. */
export interface McpAppInlinePreviewState {
  /** Current load state of the preview's fetch. */
  status: McpAppInlinePreviewStatus;
  /** Present only when `status` is `Ready`. */
  content?: McpAppCanvasContent;
  /** Re-fetches the resource and re-resolves the tool result from scratch, bypassing `cache`. */
  reload: () => void;
}

/**
 * Fetches an MCP App's `ui://` resource and resolves its seeded tool result
 * for a compact, inline preview embedded directly under a message — a
 * lighter-weight sibling of a full-width canvas that mounts independently of
 * any canvas/side-panel machinery, so it can render alongside the message
 * body instead of taking over the canvas. Builds `content.hostContext` from
 * `hostAdapter.hostContext` so the app can render a layout appropriate to
 * where it's mounted.
 *
 * `cache` (shared with a full-width canvas via the same
 * `useMcpAppResponseCache` instance, keyed by `cacheKey`) is checked before
 * fetching — switching from this preview to the full canvas (or back) for
 * the same message reuses the same fetch/live-tool-re-call instead of
 * repeating it. Call the returned `reload` to bypass and refresh it.
 */
export const useMcpAppInlinePreview = (
  match: McpAppToolRef | undefined,
  toolCall: McpAppToolCallSeed | undefined,
  cache: McpAppResponseCache,
  cacheKey: string,
  hostAdapter: McpAppHostAdapter,
): McpAppInlinePreviewState => {
  const { hostContext, sandboxUrl, fetchResourceHtml, callTool } = hostAdapter;
  const [html, setHtml] = useState<string>();
  const [toolResult, setToolResult] = useState<CallToolResult>();
  /*
   * Lazy-initialized so an unconfigured sandbox never renders the loading
   * spinner for a frame before the effect below flips it to `Unavailable` —
   * `useEffect` runs after the browser paints, so seeding `Loading`
   * unconditionally here would flash the preview box even though it's about
   * to disappear.
   */
  const [status, setStatus] = useState<McpAppInlinePreviewStatus>(() =>
    match == null || sandboxUrl == null
      ? McpAppInlinePreviewStatus.Unavailable
      : McpAppInlinePreviewStatus.Loading,
  );
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    cache.invalidate(cacheKey);
    setReloadToken((n) => n + 1);
  }, [cache, cacheKey]);

  const loadPreview = useCallback(
    async (isCancelled: () => boolean) => {
      if (match == null || sandboxUrl == null) return;

      try {
        const seedKey = computeMcpAppSeedKey(toolCall);
        const cached = cache.get(cacheKey, seedKey);
        let fetchedHtml: string;
        let resolvedResult: CallToolResult | undefined;
        if (cached) {
          ({ html: fetchedHtml, toolResult: resolvedResult } = cached);
        } else {
          [fetchedHtml, resolvedResult] = await Promise.all([
            fetchResourceHtml(match.toolsetId, match.resourceUri),
            resolveMcpAppToolResult(match, toolCall, callTool),
          ]);
          cache.set(
            cacheKey,
            { html: fetchedHtml, toolResult: resolvedResult },
            seedKey,
          );
        }
        if (isCancelled()) return;
        setHtml(fetchedHtml);
        setToolResult(resolvedResult);
        setStatus(McpAppInlinePreviewStatus.Ready);
      } catch {
        if (!isCancelled()) setStatus(McpAppInlinePreviewStatus.Error);
      }
    },
    [match, toolCall, sandboxUrl, cache, cacheKey, fetchResourceHtml, callTool],
  );

  useEffect(() => {
    if (match == null || sandboxUrl == null) {
      setStatus(McpAppInlinePreviewStatus.Unavailable);
      return;
    }

    let cancelled = false;
    setStatus(McpAppInlinePreviewStatus.Loading);
    void loadPreview(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [match, sandboxUrl, loadPreview, reloadToken]);

  const onToolCall = useCallback(
    async (name: string, args: unknown): Promise<CallToolResult> => {
      if (match == null) {
        throw new Error(`Tool call "${name}" failed: no matching MCP App`);
      }
      return callTool(match.toolsetId, name, args, match.kind);
    },
    [match, callTool],
  );

  if (
    status !== McpAppInlinePreviewStatus.Ready ||
    match == null ||
    sandboxUrl == null ||
    html == null
  ) {
    return { status, reload };
  }

  return {
    status,
    reload,
    content: {
      type: AttachmentContentType.McpApp,
      html,
      sandboxUrl,
      toolName: match.mcpToolName,
      toolInput: toolCall?.toolInput,
      toolResult,
      hostContext,
      onToolCall,
    },
  };
};
