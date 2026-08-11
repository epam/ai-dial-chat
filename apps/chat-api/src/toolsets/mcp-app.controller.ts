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
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { GetToolsetDto } from './dto/get-toolset.dto';
import {
  GetMcpAppResourceDto,
  ListMcpAppToolsQueryDto,
  ListMcpAppToolsResponseDto,
  McpAppToolCallRequestDto,
  McpAppToolCallResponseDto,
} from './dto/mcp-app.dto';
import { McpAppService } from './mcp-app.service';

@ApiTags('toolsets')
@Controller({ path: 'toolsets', version: '1' })
export class McpAppController {
  constructor(private readonly mcpAppService: McpAppService) {}

  @Get(':toolsetName/mcp-app-resource')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
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
  @ApiResponse({ status: 200, description: 'HTML widget content' })
  @ApiResponse({ status: 400, description: 'Invalid resourceUri' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Toolset or resource not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
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
    const { body, headers } = await this.mcpAppService.getResource(
      params.toolsetName,
      query.resourceUri,
      at,
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
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'listMcpAppTools',
    summary: 'List MCP Apps-capable tools for an MCP-enabled deployment',
    description:
      "Calls DIAL Core's generic MCP JSON-RPC proxy's tools/list for the " +
      'given deployment (toolset or application) and returns only the ' +
      'tools that declare an MCP Apps UI resource (`_meta.ui.resourceUri`).',
  })
  @ApiResponse({ status: 200, type: ListMcpAppToolsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid deploymentId or kind' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: "DIAL Core's proxied tools/list failed",
  })
  async listMcpAppTools(
    @Req() req: Request,
    @Query() query: ListMcpAppToolsQueryDto,
  ): Promise<ListMcpAppToolsResponseDto> {
    const { at } = req.user as SessionUser;
    const tools = await this.mcpAppService.listAppTools(
      query.deploymentId,
      query.kind,
      at,
    );
    return { tools };
  }

  @Post(':toolsetName/mcp-app-tool-call')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    operationId: 'callToolsetMcpAppTool',
    summary: "Forward an MCP App's self-initiated tool call",
    description:
      'Validates toolName against the tools the MCP session currently ' +
      'exposes, then forwards a tools/call JSON-RPC request through DIAL ' +
      "Core's existing generic MCP proxy for this toolset. Not cached — " +
      'every call is a live, potentially side-effecting tool invocation.',
  })
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
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: "DIAL Core's proxied tools/call failed",
  })
  async callMcpAppTool(
    @Req() req: Request,
    @Param() params: GetToolsetDto,
    @Body() body: McpAppToolCallRequestDto,
  ): Promise<McpAppToolCallResponseDto> {
    const { at } = req.user as SessionUser;
    const result = await this.mcpAppService.callTool(
      params.toolsetName,
      body.toolName,
      body.arguments,
      at,
    );
    return { result };
  }
}
