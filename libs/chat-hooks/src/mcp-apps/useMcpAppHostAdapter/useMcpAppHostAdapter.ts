import type { CallMcpAppTool, McpAppHostAdapter } from '@epam/ai-dial-mcp-apps';
import { useMemo } from 'react';
import { getApiErrorMessage } from '../../api-error/api-error';
import type { McpAppsApiClient } from '../mcp-apps-api-client';
import {
  useMcpAppHostContext,
  type McpAppHostContextParams,
} from '../useMcpAppHostContext/useMcpAppHostContext';

/**
 * Builds the `McpAppHostAdapter` a host injects into `@epam/ai-dial-mcp-apps`'s
 * hooks/components, wiring the library's host-context/tool-call/resource-fetch
 * contract to a configured `McpAppsApiClient` and this app's theme/locale/config
 * values (`hostContextParams`, `sandboxUrl`) — this hook itself never reads app
 * context, so a host builds those values wherever it already has them.
 */
export const useMcpAppHostAdapter = (
  displayMode: 'inline' | 'fullscreen',
  client: McpAppsApiClient,
  sandboxUrl: string | null,
  hostContextParams: McpAppHostContextParams,
): McpAppHostAdapter => {
  const hostContext = useMcpAppHostContext(displayMode, hostContextParams);

  const callTool = useMemo<CallMcpAppTool>(
    () => async (toolsetId, toolName, args, kind) => {
      try {
        return await client.callTool(toolsetId, toolName, args, kind);
      } catch (error) {
        throw new Error(
          (await getApiErrorMessage(error)) ?? `Tool call "${toolName}" failed`,
        );
      }
    },
    [client],
  );

  return useMemo(
    () => ({
      hostContext,
      sandboxUrl,
      fetchResourceHtml: client.fetchResourceHtml,
      callTool,
    }),
    [hostContext, sandboxUrl, client.fetchResourceHtml, callTool],
  );
};
