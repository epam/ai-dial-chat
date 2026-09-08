import {
  McpAppToolCallRequestDtoKindEnum,
  ResponseError,
  type ListMcpToolNamesKindEnum,
  type McpAppToolSummaryDto,
  type ToolsetsApi,
} from '@epam/ai-dial-chat-api-client';
import type {
  CallMcpAppTool,
  FetchMcpAppResourceHtml,
  McpDeploymentKind,
} from '@epam/ai-dial-mcp-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { safeDecodeURIComponent } from '../shared/string-utils';

/** A single MCP tool that declares an MCP Apps UI resource. */
export type McpAppToolSummary = McpAppToolSummaryDto;

/** Thrown by `McpAppsApiClient.fetchResourceHtml` on a non-OK response, carrying the HTTP status so callers can distinguish `403` (forbidden) from any other failure. */
export class McpAppResourceFetchError extends Error {
  constructor(public readonly status: number) {
    super(`Failed to fetch MCP app resource: HTTP ${status}`);
  }
}

/** The MCP Apps API surface produced by {@link createMcpAppsApiClient}. */
export interface McpAppsApiClient {
  /** Fetches a toolset's MCP Apps `ui://` resource and resolves to its HTML body. Throws `McpAppResourceFetchError` on a non-OK response. */
  fetchResourceHtml: FetchMcpAppResourceHtml;
  /** Forwards an MCP App's tool call (self-initiated, or `@epam/ai-dial-mcp-apps`'s live re-call) through chat-api. */
  callTool: CallMcpAppTool;
  /** Lists the tools of an MCP-capable deployment that declare an MCP Apps UI resource. */
  listAppTools: (
    deploymentId: string,
    kind: McpDeploymentKind,
  ) => Promise<McpAppToolSummary[]>;
  /** Lists every tool name exposed by an MCP-capable deployment's `tools/list`, unfiltered. */
  listToolNames: (
    deploymentId: string,
    kind: McpDeploymentKind,
  ) => Promise<string[]>;
}

/**
 * Wraps the generated `ToolsetsApi` in the surface `useMcpAppTools`,
 * `useOpenMcpAppCanvas`, and `@epam/ai-dial-mcp-apps`'s hooks/utilities call,
 * so a host app configures one `ToolsetsApi` instance (base URL, auth
 * headers, CSRF) and passes it here once. Mirrors `createPublishApiClient`.
 */
export const createMcpAppsApiClient = (
  toolsetsApi: ToolsetsApi,
): McpAppsApiClient => ({
  fetchResourceHtml: async (toolsetId, resourceUri) => {
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
  },
  callTool: async (toolsetId, toolName, args, kind) => {
    const { result } = await toolsetsApi.callToolsetMcpAppTool({
      toolsetName: safeDecodeURIComponent(toolsetId),
      mcpAppToolCallRequestDto: {
        toolName,
        arguments: args as object,
        kind: kind as McpAppToolCallRequestDtoKindEnum,
      },
    });
    return result as CallToolResult;
  },
  listAppTools: async (deploymentId, kind) => {
    const { tools } = await toolsetsApi.listMcpAppTools({
      deploymentId: safeDecodeURIComponent(deploymentId),
      kind,
    });
    return tools;
  },
  listToolNames: async (deploymentId, kind) => {
    const { toolNames } = await toolsetsApi.listMcpToolNames({
      deploymentId: safeDecodeURIComponent(deploymentId),
      kind: kind as ListMcpToolNamesKindEnum,
    });
    return toolNames;
  },
});
