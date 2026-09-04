import {
  AttachmentContentType,
  type McpAppCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import { getApiErrorMessage } from '@epam/ai-dial-chat-hooks';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useState } from 'react';
import {
  callMcpAppTool,
  fetchMcpAppResourceHtml,
} from '../../server-api/mcp-apps';
import { resolveMcpAppToolResult } from '../../utils/mcp-app';
import type { McpAppToolRef } from '../conversation/useMcpAppTools';
import { useMcpAppHostContext } from './useMcpAppHostContext';
import type { McpAppResponseCache } from './useMcpAppResponseCache';
import { useMcpAppSandboxUrl } from './useMcpAppSandboxUrl';
import type { McpAppToolCallSeed } from './useOpenMcpAppCanvas';

/** Load state of `useMcpAppInlinePreview`'s fetch. */
export enum McpAppInlinePreviewStatus {
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
  Unavailable = 'unavailable',
}

export interface McpAppInlinePreviewState {
  status: McpAppInlinePreviewStatus;
  /** Present only when `status` is `Ready`. */
  content?: McpAppCanvasContent;
  /** Re-fetches the resource and re-resolves the tool result from scratch, bypassing `cache`. */
  reload: () => void;
}

/**
 * Fetches an MCP App's `ui://` resource and resolves its seeded tool result
 * for a compact, inline preview embedded directly under a message — a
 * lighter-weight sibling of `useOpenMcpAppCanvas` that mounts independently
 * of `AttachmentCanvas`'s side-panel/loading-state machinery, so it can
 * render alongside the message body instead of taking over the canvas.
 * Builds `hostContext` with `displayMode: 'inline'` so the app can render a
 * more compact layout than it would inside the full-width canvas.
 *
 * `cache` (shared with `useOpenMcpAppCanvas` via the same
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
): McpAppInlinePreviewState => {
  const mcpAppSandboxUrl = useMcpAppSandboxUrl();
  const hostContext = useMcpAppHostContext('inline');
  const [html, setHtml] = useState<string>();
  const [toolResult, setToolResult] = useState<CallToolResult>();
  const [status, setStatus] = useState<McpAppInlinePreviewStatus>(
    McpAppInlinePreviewStatus.Loading,
  );
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    cache.invalidate(cacheKey);
    setReloadToken((n) => n + 1);
  }, [cache, cacheKey]);

  useEffect(() => {
    if (match == null || mcpAppSandboxUrl == null) {
      setStatus(McpAppInlinePreviewStatus.Unavailable);
      return;
    }

    let cancelled = false;
    setStatus(McpAppInlinePreviewStatus.Loading);

    void (async () => {
      try {
        const cached = cache.get(cacheKey);
        let fetchedHtml: string;
        let resolvedResult: CallToolResult | undefined;
        if (cached) {
          ({ html: fetchedHtml, toolResult: resolvedResult } = cached);
        } else {
          [fetchedHtml, resolvedResult] = await Promise.all([
            fetchMcpAppResourceHtml(match.toolsetId, match.resourceUri),
            resolveMcpAppToolResult(match, toolCall),
          ]);
          cache.set(cacheKey, { html: fetchedHtml, toolResult: resolvedResult });
        }
        if (cancelled) return;
        setHtml(fetchedHtml);
        setToolResult(resolvedResult);
        setStatus(McpAppInlinePreviewStatus.Ready);
      } catch {
        if (!cancelled) setStatus(McpAppInlinePreviewStatus.Error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [match, toolCall, mcpAppSandboxUrl, cache, cacheKey, reloadToken]);

  const onToolCall = useCallback(
    async (name: string, args: unknown): Promise<CallToolResult> => {
      if (match == null) {
        throw new Error(`Tool call "${name}" failed: no matching MCP App`);
      }
      try {
        return (await callMcpAppTool(
          match.toolsetId,
          name,
          args,
          match.kind,
        )) as CallToolResult;
      } catch (error) {
        throw new Error(
          (await getApiErrorMessage(error)) ?? `Tool call "${name}" failed`,
        );
      }
    },
    [match],
  );

  if (
    status !== McpAppInlinePreviewStatus.Ready ||
    match == null ||
    mcpAppSandboxUrl == null ||
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
      sandboxUrl: mcpAppSandboxUrl,
      toolName: match.mcpToolName,
      toolInput: toolCall?.toolInput,
      toolResult,
      hostContext,
      onToolCall,
    },
  };
};
