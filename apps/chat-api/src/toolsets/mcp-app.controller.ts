import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  ApiDialCoreErrors,
  DIAL_CORE_RATE_LIMITED_RESPONSE,
} from '../common/dial/api-dial-core-errors.decorator';
import { GetToolsetDto } from './dto/get-toolset.dto';
import {
  GetMcpAppResourceDto,
  ListMcpAppToolsQueryDto,
  ListMcpAppToolsResponseDto,
  ListMcpToolNamesResponseDto,
  McpAppToolCallRequestDto,
  McpAppToolCallResponseDto,
} from './dto/mcp-app.dto';
import { McpAppRateLimitException } from './mcp-app-rate-limit.exception';
import { McpAppService } from './mcp-app.service';

/** Runs `call`, forwarding DIAL Core's `Retry-After` when it rejects with 429. */
const withRetryAfter = async <T>(
  res: Response,
  call: () => Promise<T>,
): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    if (error instanceof McpAppRateLimitException && error.retryAfter) {
      res.setHeader('Retry-After', error.retryAfter);
    }
    throw error;
  }
};

@ApiTags('toolsets')
@Controller({ path: 'toolsets', version: '1' })
export class McpAppController {
  constructor(private readonly mcpAppService: McpAppService) {}

  @Get(':toolsetName/mcp-app-resource')
  @ApiOperation({
    operationId: 'getToolsetMcpAppResource',
    summary: "Fetch a toolset's MCP Apps ui:// resource",
    description:
      "Raw-passthrough proxy of DIAL Core's " +
      'GET /v1/deployments/{deployment_name}/mcp/resources?uri=... — the ' +
      "response body is Core's resource body unchanged, forwarded with " +
      'Content-Type/Content-Security-Policy/X-Content-Type-Options from ' +
      'Core. Cached server-side for 30 seconds per toolset+resourceUri.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, description: 'HTML widget content' })
  @ApiResponse({ status: 400, description: 'Invalid resourceUri' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Toolset or resource not found' })
  @ApiResponse(DIAL_CORE_RATE_LIMITED_RESPONSE)
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  async getMcpAppResource(
    @Req() req: Request,
    @Res() res: Response,
    @Param() params: GetToolsetDto,
    @Query() query: GetMcpAppResourceDto,
  ): Promise<void> {
    const { at } = req.user as SessionUser;
    const { body, headers } = await withRetryAfter(res, () =>
      this.mcpAppService.getResource(params.toolsetName, query.resourceUri, at),
    );
    res.set(headers);
    res.send(body);
  }

  /**
   * `deploymentId`/`kind` are query params, not a path segment: an
   * application id may contain whitespace once Express decodes it, and a
   * literal `:toolsetName`-shaped path risks a route collision with
   * `ToolsetsController`'s own `:toolsetName` route (registered first).
   */
  @Get('mcp-apps/tools')
  @ApiOperation({
    operationId: 'listMcpAppTools',
    summary: 'List MCP Apps-capable tools for an MCP-enabled deployment',
    description:
      "Calls DIAL Core's generic MCP JSON-RPC proxy's tools/list for the " +
      'given deployment (toolset or application) and returns only the ' +
      'tools that declare an MCP Apps UI resource (`_meta.ui.resourceUri`).',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, type: ListMcpAppToolsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid deploymentId or kind' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse(DIAL_CORE_RATE_LIMITED_RESPONSE)
  @ApiResponse({
    status: 502,
    description: "DIAL Core's proxied tools/list failed",
  })
  async listMcpAppTools(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ListMcpAppToolsQueryDto,
  ): Promise<ListMcpAppToolsResponseDto> {
    const { at } = req.user as SessionUser;
    const tools = await withRetryAfter(res, () =>
      this.mcpAppService.listAppTools(query.deploymentId, query.kind, at),
    );
    return { tools };
  }

  /**
   * Shares `deploymentId`/`kind` query params with `listMcpAppTools` for the
   * same route-collision reason documented on that endpoint above.
   */
  @Get('mcp-apps/tool-names')
  @ApiOperation({
    operationId: 'listMcpToolNames',
    summary: 'List every tool name exposed by an MCP-enabled deployment',
    description:
      "Calls DIAL Core's generic MCP JSON-RPC proxy's tools/list for the " +
      'given deployment (toolset or application) and returns every tool ' +
      "name, unfiltered — used to populate the toolset editor's " +
      '"Allowed tools" picker.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 200, type: ListMcpToolNamesResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid deploymentId or kind' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse(DIAL_CORE_RATE_LIMITED_RESPONSE)
  @ApiResponse({
    status: 502,
    description: "DIAL Core's proxied tools/list failed",
  })
  async listMcpToolNames(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ListMcpAppToolsQueryDto,
  ): Promise<ListMcpToolNamesResponseDto> {
    const { at } = req.user as SessionUser;
    const toolNames = await withRetryAfter(res, () =>
      this.mcpAppService.listToolNames(query.deploymentId, query.kind, at),
    );
    return { toolNames };
  }

  @Post(':toolsetName/mcp-app-tool-call')
  @ApiOperation({
    operationId: 'callToolsetMcpAppTool',
    summary: "Forward an MCP App's self-initiated tool call",
    description:
      'Validates toolName against the tools the MCP session currently ' +
      'exposes, then forwards a tools/call JSON-RPC request through DIAL ' +
      "Core's existing generic MCP proxy for this toolset. Not cached — " +
      'every call is a live, potentially side-effecting tool invocation.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    type: McpAppToolCallResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Malformed body' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or toolName is not exposed by this toolset',
  })
  @ApiResponse({ status: 404, description: 'Toolset not found' })
  @ApiResponse(DIAL_CORE_RATE_LIMITED_RESPONSE)
  @ApiResponse({
    status: 502,
    description: "DIAL Core's proxied tools/call failed",
  })
  async callMcpAppTool(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param() params: GetToolsetDto,
    @Body() body: McpAppToolCallRequestDto,
  ): Promise<McpAppToolCallResponseDto> {
    const { at } = req.user as SessionUser;
    const result = await withRetryAfter(res, () =>
      this.mcpAppService.callTool(
        params.toolsetName,
        body.toolName,
        body.arguments,
        body.kind,
        at,
      ),
    );
    return { result };
  }
}
