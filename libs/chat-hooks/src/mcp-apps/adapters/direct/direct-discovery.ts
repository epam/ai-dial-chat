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

/** The fields of the active deployment that decide direct discovery. */
export interface DirectDiscoveryTarget {
  /** Deployment id. */
  id: string | undefined;
  /** Deployment type. */
  type: DeploymentItemDto['type'] | undefined;
  /** Whether the deployment declares `features.mcp`. */
  hasMcp: boolean;
}

/**
 * Lists the MCP Apps tools the deployment itself exposes, or none when it is not an MCP server.
 * @param client - MCP Apps API client
 * @param target - id, type and MCP capability of the active deployment
 */
export const discoverDirectTools = async (
  client: Pick<McpAppsApiClient, 'listAppTools'>,
  { id, type, hasMcp }: DirectDiscoveryTarget,
): Promise<McpAppToolRef[]> => {
  if (!hasMcp || id == null) return [];
  if (type !== 'toolset' && type !== 'application') return [];
  const kind =
    type === 'toolset'
      ? McpDeploymentKind.Toolset
      : McpDeploymentKind.Application;

  try {
    const tools = await client.listAppTools(id, kind);
    return tools.map(({ resourceUri, toolName }) => ({
      toolsetId: id,
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
