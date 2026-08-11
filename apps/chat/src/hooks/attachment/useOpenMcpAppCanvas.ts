import {
  AttachmentContentType,
  AttachmentErrorType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { getApiErrorMessage } from '../../server-api/api-error';
import {
  callMcpAppTool,
  fetchMcpAppResourceHtml,
  McpAppResourceFetchError,
} from '../../server-api/mcp-apps';
import type { McpAppToolRef } from '../conversation/useMcpAppTools';
import { useMcpAppSandboxUrl } from './useMcpAppSandboxUrl';

/** Original tool call's arguments/result, seeded into the mounted app so it renders that invocation immediately instead of an empty initial state. */
export interface McpAppToolCallSeed {
  toolInput?: Record<string, unknown>;
  toolResult?: CallToolResult;
}

/**
 * Returns `openMcpAppCanvas`, an async function that opens the attachment
 * canvas for a discovered MCP App tool. `canvasKey`, when passed, is
 * forwarded as the canvas's `attachmentId` so callers can compare it against
 * `useAttachmentCanvas().attachmentId` to know whether this exact canvas is
 * the one currently open. `toolCall`, when passed, seeds the mounted app's
 * initial `toolInput`/`toolResult`. Returns `true` if the canvas was opened,
 * `false` if no sandbox proxy is configured or the resource failed to load.
 */
export const useOpenMcpAppCanvas = () => {
  const { t } = useTranslation();
  const { openCanvas, openCanvasLoading } = useAttachmentCanvas();
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const mcpAppSandboxUrl = useMcpAppSandboxUrl();

  const openMcpAppCanvas = useCallback(
    async (
      match: McpAppToolRef,
      canvasKey?: string,
      toolCall?: McpAppToolCallSeed,
    ): Promise<boolean> => {
      if (mcpAppSandboxUrl == null) {
        return false;
      }

      const title = t(AttachmentCanvasI18nKeys.McpAppTitle);
      closePanel();
      closeSourcesPanel();
      openCanvasLoading(title, canvasKey);

      try {
        const html = await fetchMcpAppResourceHtml(
          match.toolsetId,
          match.resourceUri,
        );
        openCanvas(
          {
            type: AttachmentContentType.McpApp,
            html,
            sandboxUrl: mcpAppSandboxUrl,
            toolName: match.mcpToolName,
            toolInput: toolCall?.toolInput,
            toolResult: toolCall?.toolResult,
            onToolCall: async (name, args) => {
              try {
                return (await callMcpAppTool(
                  match.toolsetId,
                  name,
                  args,
                )) as CallToolResult;
              } catch (error) {
                throw new Error(
                  (await getApiErrorMessage(error)) ??
                    `Tool call "${name}" failed`,
                );
              }
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
    ],
  );

  return { openMcpAppCanvas };
};
