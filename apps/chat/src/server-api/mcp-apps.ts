import {
  McpAppToolCallRequestDtoKindEnum,
  ResponseError,
  type ListMcpAppToolsKindEnum,
  type McpAppToolSummaryDto,
} from '@epam/ai-dial-chat-api-client';
import { safeDecodeURIComponent } from '../utils/string-utils';
import { toolsetsApi } from './api-client';

/** Which of Core's two MCP proxy route prefixes a deployment id resolves through. */
export type McpDeploymentKind = ListMcpAppToolsKindEnum;

/** A single MCP tool that declares an MCP Apps UI resource. */
export type McpAppToolSummary = McpAppToolSummaryDto;

/** Thrown by `fetchMcpAppResourceHtml` on a non-OK response, carrying the HTTP status so callers can distinguish `403` (forbidden) from any other failure. */
export class McpAppResourceFetchError extends Error {
  constructor(public readonly status: number) {
    super(`Failed to fetch MCP app resource: HTTP ${status}`);
  }
}

/** Fetches a toolset's MCP Apps `ui://` resource and resolves to its HTML body. Throws `McpAppResourceFetchError` on a non-OK response. */
export const fetchMcpAppResourceHtml = async (
  toolsetId: string,
  resourceUri: string,
): Promise<string> => {
  try {
    const { raw } = await toolsetsApi.getToolsetMcpAppResourceRaw({
      toolsetName: safeDecodeURIComponent(toolsetId),
      resourceUri,
    });
    return await raw.text();
  } catch (err) {
    if (err instanceof ResponseError) {
      throw new McpAppResourceFetchError(err.response.status);
    }
    throw err;
  }
};

/** Forwards an MCP App's self-initiated tool call through chat-api. */
export const callMcpAppTool = async (
  toolsetId: string,
  toolName: string,
  args: unknown,
  kind: McpDeploymentKind,
): Promise<unknown> => {
  const { result } = await toolsetsApi.callToolsetMcpAppTool({
    toolsetName: safeDecodeURIComponent(toolsetId),
    mcpAppToolCallRequestDto: {
      toolName,
      arguments: args as object,
      kind: kind as McpAppToolCallRequestDtoKindEnum,
    },
  });
  return result;
};

/** Lists the tools of an MCP-capable deployment that declare an MCP Apps UI resource. */
export const listMcpAppTools = async (
  deploymentId: string,
  kind: McpDeploymentKind,
): Promise<McpAppToolSummary[]> => {
  const { tools } = await toolsetsApi.listMcpAppTools({
    deploymentId: safeDecodeURIComponent(deploymentId),
    kind,
  });
  return tools;
};
