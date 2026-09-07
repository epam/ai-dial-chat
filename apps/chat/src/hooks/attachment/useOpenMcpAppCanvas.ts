import {
  AttachmentContentType,
  AttachmentErrorType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  computeMcpAppSeedKey,
  resolveMcpAppToolResult,
  type McpAppResponseCache,
  type McpAppToolCallSeed,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { McpAppResourceFetchError } from '../../server-api/mcp-apps';
import { useMcpAppHostAdapter } from './useMcpAppHostAdapter';

/**
 * Returns `openMcpAppCanvas`, an async function that opens the attachment
 * canvas for a discovered MCP App tool. `canvasKey`, when passed, is
 * forwarded as the canvas's `attachmentId` (and as the key into `cache`) so
 * callers can compare it against `useAttachmentCanvas().attachmentId` to
 * know whether this exact canvas is the one currently open. `toolCall`, when
 * passed, seeds the mounted app's initial `toolInput`/`toolResult`. Returns
 * `true` if the canvas was opened, `false` if no sandbox proxy is configured
 * or the resource failed to load.
 *
 * `cache` (shared with `useMcpAppInlinePreview` via the same
 * `useMcpAppResponseCache` instance) is checked before fetching the resource
 * or re-resolving the tool result — reopening the canvas for a message
 * already seen (inline or in a prior canvas open) reuses that fetch instead
 * of repeating it. Pass `forceReload: true` (wired to the canvas header's
 * reload button, `content.onReload`) to bypass and refresh the cache entry.
 */
export const useOpenMcpAppCanvas = (cache: McpAppResponseCache) => {
  const { t } = useTranslation();
  const { openCanvas, openCanvasLoading } = useAttachmentCanvas();
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const { hostContext, sandboxUrl, fetchResourceHtml, callTool } =
    useMcpAppHostAdapter('fullscreen');

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

      const title = t(AttachmentCanvasI18nKeys.McpAppTitle);
      closePanel();
      closeSourcesPanel();
      openCanvasLoading(title, canvasKey);

      try {
        const seedKey = computeMcpAppSeedKey(toolCall);
        const cached =
          canvasKey != null && !forceReload
            ? cache.get(canvasKey, seedKey)
            : undefined;

        let html: string;
        let toolResult: CallToolResult | undefined;
        if (cached) {
          ({ html, toolResult } = cached);
        } else {
          html = await fetchResourceHtml(match.toolsetId, match.resourceUri);
          toolResult = await resolveMcpAppToolResult(
            match,
            toolCall,
            callTool,
          );
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
          title,
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
            label: t(
              isForbidden
                ? AttachmentCanvasI18nKeys.McpAppForbiddenErrorLabel
                : AttachmentCanvasI18nKeys.McpAppLoadErrorLabel,
            ),
          },
          title,
          canvasKey,
        );
        return false;
      }
    },
    [
      t,
      openCanvas,
      openCanvasLoading,
      closePanel,
      closeSourcesPanel,
      sandboxUrl,
      hostContext,
      fetchResourceHtml,
      callTool,
      cache,
    ],
  );

  useEffect(() => {
    openMcpAppCanvasRef.current = openMcpAppCanvas;
  }, [openMcpAppCanvas]);

  return { openMcpAppCanvas };
};
