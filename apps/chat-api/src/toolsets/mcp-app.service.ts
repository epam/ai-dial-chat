import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import {
  MCP_CLIENT_INFO,
  MCP_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION_HEADER,
  MCP_SESSION_ID_HEADER,
} from './constants/mcp-protocol';
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

/** The subset of the MCP `initialize` result this proxy acts on. */
interface McpInitializeResult {
  protocolVersion?: string;
}

/** A completed Streamable HTTP handshake, replayed on every retried request. */
interface McpSession {
  /** Server-assigned session id; absent when the server opts out of sessions. */
  id?: string;
  /** Version the server negotiated in its `initialize` result. */
  protocolVersion: string;
}

/*
 * The Streamable HTTP transport signals a missing or invalid session at the
 * HTTP layer, and only there: 400 when the server requires a session id the
 * request did not carry, 404 when the id it carried has expired or was
 * terminated. Every other failure — an upstream 5xx, a JSON-RPC error inside
 * a 200 body, a timeout — says nothing about the session, and retrying it
 * after a handshake would re-send a `tools/call` the server may already have
 * executed. Narrow on purpose: the fallback exists to complete a handshake,
 * not to retry arbitrary failures.
 */
const isMissingSessionError = (err: unknown): boolean =>
  err instanceof BadRequestException || err instanceof NotFoundException;

interface McpTool {
  name: string;
  /** Present when the tool declares an MCP Apps UI resource, per the MCP Apps spec's `tools/list` convention. */
  _meta?: { ui?: { resourceUri?: string } };
}

const RESOURCE_CACHE_TTL_MS = 30_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;

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
 * Reads a JSON-RPC message out of an MCP proxy response body, which the
 * upstream server may send either as a single JSON object or as an SSE
 * stream — the `Accept` header this proxy sends allows both.
 */
const parseJsonRpcBody = <T>(
  raw: string,
  contentType: string,
): JsonRpcResponse<T> =>
  (contentType.includes('text/event-stream')
    ? parseJsonRpcSseBody(raw)
    : JSON.parse(raw)) as JsonRpcResponse<T>;

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

  /*
   * Every Core MCP path is built by the SDK operation itself
   * (`getApplicationMcpResources`, `postToolSetMcp`, `postApplicationMcp`),
   * which is also what keeps the kind-specific prefixes straight: toolsets
   * use `/v1/toolset/{id}/mcp`, applications `/v1/deployments/{id}/mcp`.
   *
   * The deployment id is still encoded per path segment
   * (`toolsets/{bucket}/{name}`), never as a whole — the SDK interpolates the
   * id verbatim, Core's routes match the path form, and a `%2F`-encoded slash
   * inside a single segment is rejected with 400 "Invalid request to DIAL
   * Core". Same encoding as `deployments-details.service.ts`'s
   * `getToolSetTools` call.
   */

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
        /*
         * `parseAs: 'text'` keeps this a raw passthrough — the endpoint
         * serves an HTML widget, which the generated operation types as an
         * empty (`never`) success body, so the text is cast back here.
         */
        const { data, error, response } =
          await this.dialClient.client.getApplicationMcpResources(
            encodeDialResourcePath(toolsetId),
            {
              params: { query: { uri: resourceUri } },
              headers: getBearerAuthHeaders(token),
              parseAs: 'text',
              signal: AbortSignal.timeout(TOOL_CALL_TIMEOUT_MS),
            },
          );

        if (error != null) {
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

        return { body: (data as unknown as string) ?? '', headers };
      },
    });
  }

  /**
   * Lists every tool name exposed by an MCP-capable deployment's
   * `tools/list`, unfiltered — used to populate the toolset editor's
   * "Allowed tools" picker.
   */
  async listToolNames(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
  ): Promise<string[]> {
    const tools = await this.listTools(deploymentId, kind, token);
    return tools.map((tool) => tool.name);
  }

  private async listTools(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
  ): Promise<McpTool[]> {
    const response = await this.rpcRequestForDeployment<{ tools: McpTool[] }>(
      deploymentId,
      kind,
      token,
      'tools/list',
      {},
    );
    return response.tools ?? [];
  }

  async callTool(
    deploymentId: string,
    toolName: string,
    args: Record<string, unknown>,
    kind: McpDeploymentKindDto,
    token: string,
  ): Promise<unknown> {
    const tools = await this.listTools(deploymentId, kind, token);
    if (!tools.some((tool) => tool.name === toolName)) {
      this.logger.warn(
        `Rejected mcp-app-tool-call: tool "${toolName}" is not exposed by deployment "${deploymentId}"`,
      );
      throw new ForbiddenException(
        `Tool "${toolName}" is not exposed by this deployment`,
      );
    }

    return this.rpcRequestForDeployment(
      deploymentId,
      kind,
      token,
      'tools/call',
      {
        name: toolName,
        arguments: args,
      },
    );
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

  /*
   * Core's generic MCP JSON-RPC proxy is prefix-specific by deployment kind
   * (`ToolSetMcpProxyController` vs `ApplicationMcpProxyController`) —
   * confirmed via spike: a toolset id against `/v1/deployments/{id}/mcp` 404s.
   * `kind` selects the correct prefix.
   *
   * Some MCP servers require the Streamable HTTP `initialize` handshake
   * before serving any method — a direct `tools/list` is rejected until the
   * client initializes and echoes the returned `Mcp-Session-Id` header.
   * Fallback strategy: the RPC is attempted directly first; only when the
   * failure actually reports a missing or invalid session
   * (`isMissingSessionError`) is the handshake performed and the request
   * retried once. Session ids are deliberately NOT cached across requests —
   * a server that opts out of sessions may reject an unknown session header,
   * so direct-first stays the safe default.
   */
  private async rpcRequestForDeployment<T>(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await this.rpcRequest<T>(
        deploymentId,
        kind,
        token,
        method,
        params,
      );
    } catch (err) {
      /*
       * Anything that is not a session complaint is surfaced untouched: a
       * handshake cannot fix it, and `method` may be a side-effecting
       * `tools/call` the server already executed.
       */
      if (!isMissingSessionError(err)) {
        throw err;
      }

      let session: McpSession | undefined;
      try {
        session = await this.initializeMcpSession(deploymentId, kind, token);
      } catch (handshakeErr) {
        this.logger.warn(
          `MCP initialize fallback for ${kind} "${deploymentId}" failed: ${handshakeErr instanceof Error ? handshakeErr.message : String(handshakeErr)}`,
        );
      }
      if (session == null) {
        this.logger.warn(
          `MCP initialize for ${kind} "${deploymentId}" did not complete — surfacing the original "${method}" failure`,
        );
        throw err;
      }

      return this.rpcRequest<T>(
        deploymentId,
        kind,
        token,
        method,
        params,
        session,
      );
    }
  }

  /**
   * Performs the Streamable HTTP `initialize` handshake and completes the MCP
   * lifecycle by acknowledging it with `notifications/initialized`, as the
   * spec requires before any other request is served. Returns the negotiated
   * session, or `undefined` when the server answered `initialize` with a
   * JSON-RPC error or an empty result — HTTP 200 alone does not mean the
   * handshake succeeded.
   *
   * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle#initialization
   */
  private async initializeMcpSession(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
  ): Promise<McpSession | undefined> {
    const context = `mcp "initialize" for ${kind} "${deploymentId}"`;
    const { text, response } = await this.postMcpProxy(
      deploymentId,
      kind,
      token,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: MCP_CLIENT_INFO,
        },
      },
      undefined,
      context,
    );

    let body: JsonRpcResponse<McpInitializeResult>;
    try {
      body = parseJsonRpcBody<McpInitializeResult>(
        text,
        response.headers.get('content-type') ?? '',
      );
    } catch (parseErr) {
      this.logger.warn(
        `${context} returned an unparsable body: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
      return undefined;
    }

    if (body.error != null) {
      this.logger.warn(
        `${context} returned a JSON-RPC error: ${body.error.message}`,
      );
      return undefined;
    }
    if (body.result == null) {
      this.logger.warn(`${context} returned no result`);
      return undefined;
    }

    const session: McpSession = {
      id: response.headers.get(MCP_SESSION_ID_HEADER) ?? undefined,
      /*
       * A server may negotiate down to a version it supports; echoing its
       * choice back is what keeps the rest of the exchange on one version.
       * Falling back to the requested version keeps a server that omits the
       * field workable rather than failing the handshake over it.
       */
      protocolVersion: body.result.protocolVersion ?? MCP_PROTOCOL_VERSION,
    };

    await this.postMcpProxy(
      deploymentId,
      kind,
      token,
      /* A notification carries no `id` and the server answers with no body. */
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      session,
      `mcp "notifications/initialized" for ${kind} "${deploymentId}"`,
    );

    return session;
  }

  /**
   * POSTs one JSON-RPC message through DIAL Core's MCP proxy using the shared
   * SDK client, so the call carries the same `User-Agent` and transport
   * configuration as every other DIAL request. The body is read as text
   * rather than JSON because the upstream server picks the encoding per
   * response (single JSON object or SSE stream).
   */
  private async postMcpProxy(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
    body: Record<string, unknown>,
    session: McpSession | undefined,
    context: string,
  ): Promise<{ text: string; response: Response }> {
    const headers: Record<string, string> = {
      ...getBearerAuthHeaders(token),
      /*
       * MCP Streamable HTTP transport requires this on every POST —
       * confirmed via spike: Core's generic MCP proxy 406s without it,
       * since the upstream MCP server may reply as a single JSON object
       * or as an SSE stream and negotiates which via this header.
       */
      Accept: 'application/json, text/event-stream',
    };
    if (session != null) {
      headers[MCP_PROTOCOL_VERSION_HEADER] = session.protocolVersion;
      if (session.id != null) headers[MCP_SESSION_ID_HEADER] = session.id;
    }

    const encodedId = encodeDialResourcePath(deploymentId);
    const init = {
      body,
      headers,
      parseAs: 'text' as const,
      signal: AbortSignal.timeout(TOOL_CALL_TIMEOUT_MS),
    };
    const { data, error, response } =
      kind === McpDeploymentKindDto.Toolset
        ? await this.dialClient.client.postToolSetMcp(encodedId, init)
        : await this.dialClient.client.postApplicationMcp(encodedId, init);

    if (error != null) {
      mapDialHttpStatus(response.status, context, this.logger);
    }

    return { text: (data as unknown as string) ?? '', response };
  }

  private async rpcRequest<T>(
    deploymentId: string,
    kind: McpDeploymentKindDto,
    token: string,
    method: string,
    params: Record<string, unknown>,
    session?: McpSession,
  ): Promise<T> {
    const context = `mcp "${method}" for ${kind} "${deploymentId}"`;

    try {
      const { text, response } = await this.postMcpProxy(
        deploymentId,
        kind,
        token,
        { jsonrpc: '2.0', id: 1, method, params },
        session,
        context,
      );

      const body = parseJsonRpcBody<T>(
        text,
        response.headers.get('content-type') ?? '',
      );
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
        context,
        this.logger,
        TOOL_CALL_TIMEOUT_MS,
      );
    }
  }
}
