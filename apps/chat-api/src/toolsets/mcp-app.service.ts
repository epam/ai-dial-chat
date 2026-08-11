import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import { McpAppToolSummaryDto, McpDeploymentKindDto } from './dto/mcp-app.dto';

/** Response headers DIAL Core's `mcp/resources` endpoint sets and this service forwards verbatim. */
const FORWARDED_RESOURCE_HEADERS = [
  'content-type',
  'content-security-policy',
  'x-content-type-options',
] as const;

/** Raw-passthrough result of a fetched `ui://` resource, cached as one unit. */
export interface McpAppResource {
  body: string;
  headers: Partial<Record<(typeof FORWARDED_RESOURCE_HEADERS)[number], string>>;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

interface McpTool {
  name: string;
  /** Present when the tool declares an MCP Apps UI resource, per the MCP Apps spec's `tools/list` convention. */
  _meta?: { ui?: { resourceUri?: string } };
}

const RESOURCE_CACHE_TTL_MS = 30_000;
const TOOL_CALL_TIMEOUT_MS = 30_000;

/**
 * Extracts the JSON-RPC message from an MCP Streamable HTTP SSE response
 * body — the upstream MCP server may reply with a `text/event-stream`
 * instead of a single `application/json` object once the client's `Accept`
 * header allows both (confirmed via spike: Core's proxy switched to SSE
 * once `Accept: application/json, text/event-stream` was added).
 */
const parseJsonRpcSseBody = (raw: string): unknown => {
  for (const eventBlock of raw.split('\n\n')) {
    const dataLines = eventBlock
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart());
    if (dataLines.length === 0) continue;
    try {
      return JSON.parse(dataLines.join('\n'));
    } catch {
      continue;
    }
  }
  throw new Error('No parsable JSON-RPC message found in SSE response');
};

/**
 * Proxies DIAL Core's MCP Apps Phase 1 surface (`epam/ai-dial-core` PR #1745):
 * fetching a toolset's `ui://` resource as a raw passthrough, forwarding an
 * MCP App's self-initiated `tools/call` through Core's existing generic MCP
 * JSON-RPC proxy, and listing MCP Apps-capable tools (`tools/list`) for any
 * MCP-enabled deployment, toolset or application.
 */
@Injectable()
export class McpAppService {
  private readonly logger = new Logger(McpAppService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /** Core's raw-passthrough `mcp/resources` endpoint — confirmed generic across toolset and application deployments (design.md Context). */
  private deploymentMcpUrl(toolsetId: string): string {
    return `${this.dialClient.baseUrl}/v1/deployments/${encodeURIComponent(toolsetId)}/mcp`;
  }

  /**
   * Core's generic MCP JSON-RPC proxy, unlike `deploymentMcpUrl` above, is
   * prefix-specific by deployment kind (`ToolSetMcpProxyController` vs
   * `ApplicationMcpProxyController`) — confirmed via spike, a toolset id
   * against `/v1/deployments/{id}/mcp` 404s. This service only ever proxies
   * toolsets (D4), so `tools/list`/`tools/call` always use `/v1/toolset/`.
   */
  private toolsetMcpProxyUrl(toolsetId: string): string {
    return `${this.dialClient.baseUrl}/v1/toolset/${encodeURIComponent(toolsetId)}/mcp`;
  }

  async getResource(
    toolsetId: string,
    resourceUri: string,
    token: string,
  ): Promise<McpAppResource> {
    const cacheKey = `mcp-apps:resource:${toolsetId}:${resourceUri}`;

    return withCachedDialRequest<McpAppResource>({
      cacheManager: this.cacheManager,
      cacheKey,
      ttlMs: RESOURCE_CACHE_TTL_MS,
      context: `get mcp-app resource for toolset "${toolsetId}"`,
      logger: this.logger,
      fetch: async () => {
        const url = `${this.deploymentMcpUrl(toolsetId)}/resources?uri=${encodeURIComponent(resourceUri)}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(TOOL_CALL_TIMEOUT_MS),
        });

        if (!response.ok) {
          mapDialHttpStatus(
            response.status,
            `get mcp-app resource for toolset "${toolsetId}"`,
            this.logger,
          );
        }

        const headers: McpAppResource['headers'] = {};
        for (const name of FORWARDED_RESOURCE_HEADERS) {
          const value = response.headers.get(name);
          if (value != null) headers[name] = value;
        }

        return { body: await response.text(), headers };
      },
    });
  }

  private async listTools(
    toolsetId: string,
    token: string,
  ): Promise<McpTool[]> {
    const response = await this.rpcRequest<{ tools: McpTool[] }>(
      toolsetId,
      token,
      'tools/list',
      {},
    );
    return response.tools ?? [];
  }

  async callTool(
    toolsetId: string,
    toolName: string,
    args: Record<string, unknown>,
    token: string,
  ): Promise<unknown> {
    const tools = await this.listTools(toolsetId, token);
    if (!tools.some((tool) => tool.name === toolName)) {
      this.logger.warn(
        `Rejected mcp-app-tool-call: tool "${toolName}" is not exposed by toolset "${toolsetId}"`,
      );
      throw new ForbiddenException(
        `Tool "${toolName}" is not exposed by this toolset`,
      );
    }

    return this.rpcRequest(toolsetId, token, 'tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  /**
   * Lists the tools of an MCP-capable deployment (toolset or application)
   * that declare an MCP Apps UI resource (`_meta.ui.resourceUri`) — the
   * discoverable set of tools whose results can drive the canvas.
   */
  async listAppTools(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
  ): Promise<McpAppToolSummaryDto[]> {
    const { tools } = await this.rpcRequestForDeployment<{ tools?: McpTool[] }>(
      deploymentId,
      kind,
      token,
      'tools/list',
      {},
    );
    return (tools ?? [])
      .filter(
        (tool): tool is McpTool & { _meta: { ui: { resourceUri: string } } } =>
          typeof tool._meta?.ui?.resourceUri === 'string',
      )
      .map((tool) => ({
        toolName: tool.name,
        resourceUri: tool._meta.ui.resourceUri,
      }));
  }

  private async rpcRequest<T>(
    toolsetId: string,
    token: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    return this.rpcRequestForDeployment<T>(
      toolsetId,
      McpDeploymentKindDto.Toolset,
      token,
      method,
      params,
    );
  }

  /**
   * Core's generic MCP JSON-RPC proxy is prefix-specific by deployment kind
   * (`ToolSetMcpProxyController` vs `ApplicationMcpProxyController`) —
   * confirmed via spike, a toolset id against `/v1/deployments/{id}/mcp`
   * 404s. Callers that only ever proxy toolsets (D4) go through the
   * `rpcRequest` wrapper above; `listAppTools` calls this directly since it
   * must support either kind.
   */
  private async rpcRequestForDeployment<T>(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const url =
      kind === McpDeploymentKindDto.Toolset
        ? this.toolsetMcpProxyUrl(deploymentId)
        : this.deploymentMcpUrl(deploymentId);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          /*
           * MCP Streamable HTTP transport requires this on every POST —
           * confirmed via spike: Core's generic MCP proxy 406s without it,
           * since the upstream MCP server may reply as a single JSON object
           * or as an SSE stream and negotiates which via this header.
           */
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
        signal: AbortSignal.timeout(TOOL_CALL_TIMEOUT_MS),
      });

      if (!response.ok) {
        mapDialHttpStatus(
          response.status,
          `mcp "${method}" for ${kind} "${deploymentId}"`,
          this.logger,
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      const body = (
        contentType.includes('text/event-stream')
          ? parseJsonRpcSseBody(await response.text())
          : await response.json()
      ) as JsonRpcResponse<T>;
      if (body.error != null) {
        this.logger.warn(
          `DIAL Core's "${method}" returned a JSON-RPC error for ${kind} "${deploymentId}": ${body.error.message}`,
        );
        throw new BadGatewayException(body.error.message);
      }

      return body.result as T;
    } catch (err) {
      return handleDialFetchError(
        err,
        `mcp "${method}" for ${kind} "${deploymentId}"`,
        this.logger,
        TOOL_CALL_TIMEOUT_MS,
      );
    }
  }
}
