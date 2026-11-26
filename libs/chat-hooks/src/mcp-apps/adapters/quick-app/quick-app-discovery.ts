import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import {
  McpAppToolDiscovery,
  McpDeploymentKind,
  sanitizeToolName,
  type McpAppToolRef,
} from '@epam/ai-dial-mcp-apps';
import { isPublicToolsetId } from '../../../oauth/toolset-id';
import type { McpAppsApiClient } from '../../mcp-apps-api-client';

/*
 * Quick-app adapter (discovery side). TEMPORARY: replace once DIAL Core reports
 * which toolset a tool call belongs to. A quick app records `<ToolsetName>_<tool>`
 * names in `state` and nothing links the call to a toolset id, so the toolset is
 * guessed by name prefix. The tool-call side lives in
 * `libs/mcp-apps/src/adapters/quick-app`.
 */

/**
 * Drops a toolset when another toolset with the same display name is public: a private copy of a published toolset cannot have `forward_auth_token`, so a call to it reaches the MCP server without the user's identity.
 * @param toolsets - toolsets whose name prefixes a tool call seen in the conversation
 */
const preferPublicToolsets = (toolsets: DialToolsetDto[]): DialToolsetDto[] => {
  const nameOf = (toolset: DialToolsetDto) =>
    sanitizeToolName(`${toolset.displayName ?? toolset.id}`);
  const publicNames = new Set(
    toolsets.filter((toolset) => isPublicToolsetId(toolset.id)).map(nameOf),
  );
  return toolsets.filter(
    (toolset) =>
      isPublicToolsetId(toolset.id) || !publicNames.has(nameOf(toolset)),
  );
};

/**
 * Returns the toolsets whose sanitized display name prefixes one of the tool-call names, preferring public copies.
 * @param toolsets - every toolset the host knows
 * @param toolCallNames - tool-call names seen in the conversation
 */
export const findQuickAppToolsets = (
  toolsets: DialToolsetDto[],
  toolCallNames: Set<string>,
): DialToolsetDto[] =>
  preferPublicToolsets(
    toolsets.filter((toolset) => {
      const prefix = sanitizeToolName(`${toolset.displayName ?? toolset.id}_`);
      return [...toolCallNames].some((name) => name.startsWith(prefix));
    }),
  );

/**
 * Lists the MCP Apps tools of the given toolsets, re-prefixing each tool name with its toolset's name so it matches the `<Toolset>_<tool>` form quick apps record.
 * @param client - MCP Apps API client
 * @param toolsets - toolsets to inspect
 */
export const discoverQuickAppTools = async (
  client: Pick<McpAppsApiClient, 'listAppTools'>,
  toolsets: DialToolsetDto[],
): Promise<McpAppToolRef[]> => {
  const results = await Promise.all(
    toolsets.map(async (toolset) => {
      try {
        const tools = await client.listAppTools(
          toolset.id,
          McpDeploymentKind.Toolset,
        );
        return tools.map(({ resourceUri, toolName }) => ({
          toolsetId: toolset.id,
          resourceUri,
          toolName: sanitizeToolName(
            `${toolset.displayName ?? toolset.id}_${toolName}`,
          ),
          mcpToolName: toolName,
          kind: McpDeploymentKind.Toolset,
          discovery: McpAppToolDiscovery.Indirect,
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
};
