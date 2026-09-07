import { getApiErrorMessage } from '@epam/ai-dial-chat-hooks';
import type { CallMcpAppTool, McpAppHostAdapter } from '@epam/ai-dial-mcp-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useMemo } from 'react';
import {
  callMcpAppTool,
  fetchMcpAppResourceHtml,
} from '../../server-api/mcp-apps';
import { useMcpAppHostContext } from './useMcpAppHostContext';
import { useMcpAppSandboxUrl } from './useMcpAppSandboxUrl';

/**
 * Builds the `McpAppHostAdapter` this app injects into `@epam/ai-dial-mcp-apps`'s
 * hooks/components, wiring the library's host-context/tool-call/resource-fetch
 * contract to this app's config (`useMcpAppHostContext`, `useMcpAppSandboxUrl`)
 * and server-api calls.
 */
export const useMcpAppHostAdapter = (
  displayMode: 'inline' | 'fullscreen',
): McpAppHostAdapter => {
  const hostContext = useMcpAppHostContext(displayMode);
  const sandboxUrl = useMcpAppSandboxUrl();

  const callTool = useMemo<CallMcpAppTool>(
    () => async (toolsetId, toolName, args, kind) => {
      try {
        return (await callMcpAppTool(
          toolsetId,
          toolName,
          args,
          kind,
        )) as CallToolResult;
      } catch (error) {
        throw new Error(
          (await getApiErrorMessage(error)) ??
            `Tool call "${toolName}" failed`,
        );
      }
    },
    [],
  );

  return useMemo(
    () => ({
      hostContext,
      sandboxUrl,
      fetchResourceHtml: fetchMcpAppResourceHtml,
      callTool,
    }),
    [hostContext, sandboxUrl, callTool],
  );
};
