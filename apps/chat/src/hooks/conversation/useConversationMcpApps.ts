import {
  useMcpAppTools,
  useOpenMcpAppCanvas,
} from '@epam/ai-dial-chat-hooks/mcp-apps';
import { useMcpAppResponseCache } from '@epam/ai-dial-mcp-apps';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCanvasI18nKeys } from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useMcpAppHostAdapter } from '../../hooks/attachment/useMcpAppHostAdapter';
import { mcpAppsApiClient } from '../../server-api/mcp-apps';

type McpAppToolsParams = Parameters<typeof useMcpAppTools>;

interface UseConversationMcpAppsParams {
  conversationId: string;
  selectedDeployment: McpAppToolsParams[1];
  messages: McpAppToolsParams[2];
  toolsets: McpAppToolsParams[3];
}

/**
 * MCP apps for one conversation: the per-conversation tool-response cache,
 * the fullscreen host adapter and canvas opener (which closes the sources
 * panel to take its place), and the MCP-UI tools the selected deployment
 * exposes. Reads the i18n and sources-sidebar contexts itself.
 */
export const useConversationMcpApps = ({
  conversationId,
  selectedDeployment,
  messages,
  toolsets,
}: UseConversationMcpAppsParams) => {
  const { t } = useTranslation();
  const mcpAppCache = useMcpAppResponseCache(conversationId);
  const mcpAppHostAdapter = useMcpAppHostAdapter('fullscreen');
  /* The MCP app canvas takes the sources panel's place at the end edge; the
   navigation sidebar is left as the user set it. */
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();
  const mcpAppCanvasLabels = useMemo(
    () => ({
      forbiddenErrorLabel: t(
        AttachmentCanvasI18nKeys.McpAppForbiddenErrorLabel,
      ),
      loadErrorLabel: t(AttachmentCanvasI18nKeys.McpAppLoadErrorLabel),
    }),
    [t],
  );
  const { openMcpAppCanvas } = useOpenMcpAppCanvas(
    mcpAppCache,
    mcpAppHostAdapter,
    mcpAppCanvasLabels,
    closeSourcesPanel,
  );

  const mcpAppTools = useMcpAppTools(
    mcpAppsApiClient,
    selectedDeployment,
    messages,
    toolsets,
  );

  return { mcpAppCache, openMcpAppCanvas, mcpAppTools };
};
