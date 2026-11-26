import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import {
  McpAppToolDiscovery,
  McpDeploymentKind,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import type { McpAppsApiClient } from '../../mcp-apps-api-client';

/*
 * Direct adapter: the active deployment IS the MCP server (a toolset, or an
 * application declaring `features.mcp`), so its own `tools/list` is the source.
 * Not temporary in itself, but an application that merely wraps other
 * toolsets (a DIAL loop) also reports `features.mcp` and lists none of them.
 */

/**
 * Lists the MCP Apps tools the deployment itself exposes, or none when it is not an MCP server.
 * @param client - MCP Apps API client
 * @param deployment - the active deployment
 */
export const discoverDirectTools = async (
  client: Pick<McpAppsApiClient, 'listAppTools'>,
  deployment: DeploymentItemDto | undefined,
): Promise<McpAppToolRef[]> => {
  if (deployment?.features?.mcp !== true) return [];
  if (deployment.type !== 'toolset' && deployment.type !== 'application') {
    return [];
  }
  const kind =
    deployment.type === 'toolset'
      ? McpDeploymentKind.Toolset
      : McpDeploymentKind.Application;

  try {
    const tools = await client.listAppTools(deployment.id, kind);
    return tools.map(({ resourceUri, toolName }) => ({
      toolsetId: deployment.id,
      resourceUri,
      toolName,
      mcpToolName: toolName,
      kind,
      discovery: McpAppToolDiscovery.Direct,
    }));
  } catch {
    return [];
  }
};
