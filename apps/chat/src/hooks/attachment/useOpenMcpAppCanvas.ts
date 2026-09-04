import {
  AttachmentContentType,
  AttachmentErrorType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { getApiErrorMessage } from '@epam/ai-dial-chat-hooks';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import {
  callMcpAppTool,
  fetchMcpAppResourceHtml,
  McpAppResourceFetchError,
} from '../../server-api/mcp-apps';
import { resolveMcpAppToolResult } from '../../utils/mcp-app';
import type { McpAppToolRef } from '../conversation/useMcpAppTools';
import { useMcpAppHostContext } from './useMcpAppHostContext';
import type { McpAppResponseCache } from './useMcpAppResponseCache';
import { useMcpAppSandboxUrl } from './useMcpAppSandboxUrl';

/** Original tool call's arguments/result, seeded into the mounted app so it renders that invocation immediately instead of an empty initial state. */
export interface McpAppToolCallSeed {
  toolInput?: Record<string, unknown>;
  toolResult?: CallToolResult;
}

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
  const mcpAppSandboxUrl = useMcpAppSandboxUrl();
  const hostContext = useMcpAppHostContext('fullscreen');

  const openMcpAppCanvas = useCallback(
    async (
      match: McpAppToolRef,
      canvasKey?: string,
      toolCall?: McpAppToolCallSeed,
      forceReload = false,
    ): Promise<boolean> => {
      if (mcpAppSandboxUrl == null) {
        return false;
      }

      const title = t(AttachmentCanvasI18nKeys.McpAppTitle);
      closePanel();
      closeSourcesPanel();
      openCanvasLoading(title, canvasKey);

      try {
        const cached =
          canvasKey != null && !forceReload ? cache.get(canvasKey) : undefined;

        let html: string;
        let toolResult: CallToolResult | undefined;
        if (cached) {
          ({ html, toolResult } = cached);
        } else {
          html = await fetchMcpAppResourceHtml(
            match.toolsetId,
            match.resourceUri,
          );
          toolResult = await resolveMcpAppToolResult(match, toolCall);
          if (canvasKey != null) cache.set(canvasKey, { html, toolResult });
        }

        openCanvas(
          {
            type: AttachmentContentType.McpApp,
            html,
            sandboxUrl: mcpAppSandboxUrl,
            toolName: match.mcpToolName,
            toolInput: toolCall?.toolInput,
            toolResult,
            hostContext,
            onToolCall: async (name, args) => {
              try {
                return (await callMcpAppTool(
                  match.toolsetId,
                  name,
                  args,
                  match.kind,
                )) as CallToolResult;
              } catch (error) {
                throw new Error(
                  (await getApiErrorMessage(error)) ??
                    `Tool call "${name}" failed`,
                );
              }
            },
            onReload: () => {
              if (canvasKey != null) cache.invalidate(canvasKey);
              void openMcpAppCanvas(match, canvasKey, toolCall, true);
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
      mcpAppSandboxUrl,
      hostContext,
      cache,
    ],
  );

  return { openMcpAppCanvas };
};
