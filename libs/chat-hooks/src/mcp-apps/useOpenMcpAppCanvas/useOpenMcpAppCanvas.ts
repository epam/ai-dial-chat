import {
  AttachmentContentType,
  AttachmentErrorType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  computeMcpAppSeedKey,
  resolveMcpAppToolResult,
  type McpAppHostAdapter,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useRef } from 'react';
import { McpAppResourceFetchError } from '../mcp-apps-api-client';

/** User-facing text `useOpenMcpAppCanvas` needs but cannot resolve itself — a lib must not call `t()`. */
export interface UseOpenMcpAppCanvasLabels {
  /** Canvas panel title while an MCP App is loading or open. */
  title: string;
  /** Error label shown when the resource fetch is forbidden (HTTP 403). */
  forbiddenErrorLabel: string;
  /** Error label shown for any other resource-load/tool-call failure. */
  loadErrorLabel: string;
}

/**
 * Returns `openMcpAppCanvas`, an async function that opens the attachment
 * canvas for a discovered MCP App tool. `canvasKey`, when passed, is
 * forwarded as the canvas's `attachmentId` (and as the key into `cache`) so
 * callers can compare it against `useAttachmentCanvas().attachmentId` to
 * know whether this exact canvas is the one currently open. `toolCall`, when
 * passed, seeds the mounted app's initial `toolInput`/`toolResult`. Returns
 * `true` if the canvas was opened, `false` if `hostAdapter.sandboxUrl` isn't
 * configured or the resource failed to load.
 *
 * `cache` (shared with `@epam/ai-dial-mcp-apps`'s `useMcpAppInlinePreview` via
 * the same cache instance) is checked before fetching the resource or
 * re-resolving the tool result — reopening the canvas for a message already
 * seen (inline or in a prior canvas open) reuses that fetch instead of
 * repeating it, and a concurrent in-flight fetch for the same message (e.g.
 * the inline preview hasn't finished loading yet) is coalesced onto rather
 * than raced against (`cache.getOrFetch`). Pass `forceReload: true` (wired to
 * the canvas header's reload button, `content.onReload`) to bypass and
 * refresh the cache entry.
 *
 * `onBeforeOpen`, if passed, runs before the canvas opens (e.g. to close
 * other panels a host keeps mutually exclusive with the canvas) — this hook
 * has no opinion on what else is open in the host UI.
 */
export const useOpenMcpAppCanvas = (
  cache: McpAppResponseCache,
  hostAdapter: McpAppHostAdapter,
  labels: UseOpenMcpAppCanvasLabels,
  onBeforeOpen?: () => void,
) => {
  const { openCanvas, openCanvasLoading } = useAttachmentCanvas();
  const { hostContext, sandboxUrl, fetchResourceHtml, callTool } = hostAdapter;

  /*
   * `onReload` below needs to re-invoke `openMcpAppCanvas` recursively, but
   * referencing it directly from inside its own `useCallback` initializer is
   * a temporal-dead-zone access (`openMcpAppCanvas` isn't declared yet at
   * that point). Routed through a ref, updated after every render in the
   * effect below, and read only from `onReload`'s event-handler closure
   * (never during render) so the "latest" version is always called.
   */
  const openMcpAppCanvasRef = useRef<
    | ((
        match: McpAppToolRef,
        canvasKey?: string,
        toolCall?: McpAppToolCallSeed,
        forceReload?: boolean,
      ) => Promise<boolean>)
    | null
  >(null);

  const openMcpAppCanvas = useCallback(
    async (
      match: McpAppToolRef,
      canvasKey?: string,
      toolCall?: McpAppToolCallSeed,
      forceReload = false,
    ): Promise<boolean> => {
      if (sandboxUrl == null) {
        return false;
      }

      onBeforeOpen?.();
      openCanvasLoading(labels.title, canvasKey);

      try {
        const seedKey = computeMcpAppSeedKey(toolCall);
        const fetchFresh = async (): Promise<{
          html: string;
          toolResult: CallToolResult | undefined;
        }> => {
          const [html, toolResult] = await Promise.all([
            fetchResourceHtml(match.toolsetId, match.resourceUri),
            resolveMcpAppToolResult(match, toolCall, callTool),
          ]);
          return { html, toolResult };
        };

        let html: string;
        let toolResult: CallToolResult | undefined;
        if (canvasKey != null && !forceReload) {
          /*
           * `getOrFetch` coalesces this with a concurrent in-flight fetch for
           * the same message — e.g. the inline preview is still loading when
           * the user expands to the canvas — instead of racing a second,
           * redundant fetch/live tool re-call.
           */
          ({ html, toolResult } = await cache.getOrFetch(
            canvasKey,
            seedKey,
            fetchFresh,
          ));
        } else {
          ({ html, toolResult } = await fetchFresh());
          if (canvasKey != null) {
            cache.set(canvasKey, { html, toolResult }, seedKey);
          }
        }

        openCanvas(
          {
            type: AttachmentContentType.McpApp,
            html,
            sandboxUrl,
            toolName: match.mcpToolName,
            toolInput: toolCall?.toolInput,
            toolResult,
            hostContext,
            onToolCall: (name, args) =>
              callTool(match.toolsetId, name, args, match.kind),
            onReload: () => {
              if (canvasKey != null) cache.invalidate(canvasKey);
              void openMcpAppCanvasRef.current?.(
                match,
                canvasKey,
                toolCall,
                true,
              );
            },
          },
          labels.title,
          canvasKey,
        );
        return true;
      } catch (error) {
        const isForbidden =
          error instanceof McpAppResourceFetchError && error.status === 403;
        openCanvas(
          {
            type: AttachmentContentType.Error,
            errorType: isForbidden
              ? AttachmentErrorType.Forbidden
              : AttachmentErrorType.LoadFailed,
            label: isForbidden
              ? labels.forbiddenErrorLabel
              : labels.loadErrorLabel,
          },
          labels.title,
          canvasKey,
        );
        return false;
      }
    },
    [
      openCanvas,
      openCanvasLoading,
      onBeforeOpen,
      sandboxUrl,
      hostContext,
      fetchResourceHtml,
      callTool,
      cache,
      labels,
    ],
  );

  useEffect(() => {
    openMcpAppCanvasRef.current = openMcpAppCanvas;
  }, [openMcpAppCanvas]);

  return { openMcpAppCanvas };
};
