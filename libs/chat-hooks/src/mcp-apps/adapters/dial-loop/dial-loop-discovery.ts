import type { DeploymentDetailsDto } from '@epam/ai-dial-chat-api-client';
import {
  McpAppToolDiscovery,
  McpDeploymentKind,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import { isDialLoopSchema } from '../../../shared/application-schema';
import type { McpAppsApiClient } from '../../mcp-apps-api-client';

/*
 * DIAL loop adapter (discovery side). TEMPORARY: replace once DIAL Core or the
 * loop exposes the toolsets' MCP Apps tools. A loop's own `tools/list` holds
 * only loop-management tools, so the UI tools come from the toolsets named in
 * the application's configuration. The tool-call side lives in
 * `libs/mcp-apps/src/adapters/dial-loop`.
 */

/**
 * Returns the toolset ids a DIAL loop application lists in `applicationProperties.toolsets`, or none for any other kind of deployment.
 * @param details - details of the active deployment
 */
export const getDialLoopToolsetIds = (
  details: DeploymentDetailsDto | null | undefined,
): string[] => {
  const application = details?.applicationDetails;
  if (!isDialLoopSchema({ id: application?.applicationTypeSchemaId })) {
    return [];
  }

  const toolsets = (
    application?.applicationProperties as { toolsets?: unknown } | undefined
  )?.toolsets;
  return Array.isArray(toolsets)
    ? toolsets.filter((id): id is string => typeof id === 'string')
    : [];
};

/**
 * Lists the MCP Apps tools of the loop's configured toolsets, keeping each tool's real (unprefixed) name, which is how a loop reports its tool calls.
 * @param client - MCP Apps API client
 * @param toolsetIds - toolsets the loop application is configured with
 */
export const discoverDialLoopTools = async (
  client: Pick<McpAppsApiClient, 'listAppTools'>,
  toolsetIds: string[],
): Promise<McpAppToolRef[]> => {
  const results = await Promise.all(
    toolsetIds.map(async (toolsetId) => {
      try {
        const tools = await client.listAppTools(
          toolsetId,
          McpDeploymentKind.Toolset,
        );
        return tools.map(({ resourceUri, toolName }) => ({
          toolsetId,
          resourceUri,
          toolName,
          mcpToolName: toolName,
          kind: McpDeploymentKind.Toolset,
          discovery: McpAppToolDiscovery.Configured,
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
};
