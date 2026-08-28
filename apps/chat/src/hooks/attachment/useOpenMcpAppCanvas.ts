import {
  AttachmentContentType,
  AttachmentErrorType,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { getApiErrorMessage } from '@epam/ai-dial-chat-hooks';
import type { McpUiHostContext } from '@mcp-ui/client';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useTheme } from '../../context/ThemeContext';
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

/* All CSS variable names defined by the MCP UI standard (McpUiStyleVariableKey union). */
const MCP_UI_CSS_VAR_KEYS = [
  '--color-background-primary',
  '--color-background-secondary',
  '--color-background-tertiary',
  '--color-background-inverse',
  '--color-background-ghost',
  '--color-background-info',
  '--color-background-danger',
  '--color-background-success',
  '--color-background-warning',
  '--color-background-disabled',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-inverse',
  '--color-text-ghost',
  '--color-text-info',
  '--color-text-danger',
  '--color-text-success',
  '--color-text-warning',
  '--color-text-disabled',
  '--color-border-primary',
  '--color-border-secondary',
  '--color-border-tertiary',
  '--color-border-inverse',
  '--color-border-ghost',
  '--color-border-info',
  '--color-border-danger',
  '--color-border-success',
  '--color-border-warning',
  '--color-border-disabled',
  '--color-ring-primary',
  '--color-ring-secondary',
  '--color-ring-inverse',
  '--color-ring-info',
  '--color-ring-danger',
  '--color-ring-success',
  '--color-ring-warning',
  '--font-sans',
  '--font-mono',
  '--font-weight-normal',
  '--font-weight-medium',
  '--font-weight-semibold',
  '--font-weight-bold',
  '--font-text-xs-size',
  '--font-text-sm-size',
  '--font-text-md-size',
  '--font-text-lg-size',
  '--font-heading-xs-size',
  '--font-heading-sm-size',
  '--font-heading-md-size',
  '--font-heading-lg-size',
  '--font-heading-xl-size',
  '--font-heading-2xl-size',
  '--font-heading-3xl-size',
  '--font-text-xs-line-height',
  '--font-text-sm-line-height',
  '--font-text-md-line-height',
  '--font-text-lg-line-height',
  '--font-heading-xs-line-height',
  '--font-heading-sm-line-height',
  '--font-heading-md-line-height',
  '--font-heading-lg-line-height',
  '--font-heading-xl-line-height',
  '--font-heading-2xl-line-height',
  '--font-heading-3xl-line-height',
  '--border-radius-xs',
  '--border-radius-sm',
  '--border-radius-md',
  '--border-radius-lg',
  '--border-radius-xl',
  '--border-radius-full',
  '--border-width-regular',
  '--shadow-hairline',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
] as const;

type McpStyleVariables = NonNullable<
  NonNullable<McpUiHostContext['styles']>['variables']
>;

const readMcpStyleVariables = (): McpStyleVariables => {
  const computed = getComputedStyle(document.documentElement);
  const vars: Record<string, string | undefined> = {};
  for (const key of MCP_UI_CSS_VAR_KEYS) {
    const value = computed.getPropertyValue(key).trim();
    if (value) vars[key] = value;
  }
  return vars as McpStyleVariables;
};

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
  const { t, i18n } = useTranslation();
  const { openCanvas, openCanvasLoading } = useAttachmentCanvas();
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const mcpAppSandboxUrl = useMcpAppSandboxUrl();
  const { currentTheme } = useTheme();
  const { config } = useAppConfig();
  const mcpAppTheme = config.mcpAppTheme;
  const mcpAppUserAgent = config.mcpAppUserAgent;

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
        const hostContext: McpUiHostContext = {
          theme: (mcpAppTheme ?? currentTheme) as 'light' | 'dark',
          locale: i18n.language,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userAgent: mcpAppUserAgent ?? 'ai-dial-chat',
          platform: 'web',
          displayMode: 'inline',
          styles: { variables: readMcpStyleVariables() },
        };
        openCanvas(
          {
            type: AttachmentContentType.McpApp,
            html,
            sandboxUrl: mcpAppSandboxUrl,
            toolName: match.mcpToolName,
            toolInput: toolCall?.toolInput,
            toolResult: toolCall?.toolResult,
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
      i18n,
      openCanvas,
      openCanvasLoading,
      closePanel,
      closeSourcesPanel,
      mcpAppSandboxUrl,
      currentTheme,
      mcpAppTheme,
      mcpAppUserAgent,
    ],
  );

  return { openMcpAppCanvas };
};
