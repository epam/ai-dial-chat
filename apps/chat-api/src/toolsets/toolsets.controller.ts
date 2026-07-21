import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../openapi/openapi-response.dto';
import { GetToolsetDto } from './dto/get-toolset.dto';
import {
  ToolsetAuthResultDto,
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from './dto/toolset-auth.dto';
import { MutatedToolsetDto, ToolsetBodyDto } from './dto/toolset-body.dto';
import { ToolsetsService } from './toolsets.service';

@ApiTags('toolsets')
@Controller({ path: 'toolsets', version: '1' })
export class ToolsetsController {
  constructor(private readonly toolsetsService: ToolsetsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'List available toolsets',
    description:
      'Returns the list of DIAL Core toolsets visible to the authenticated session user. ' +
      "Proxies GET /openai/toolsets using the caller's session access token. " +
      'Results are cached server-side for 30 seconds per user; the response ' +
      'carries no client-facing Cache-Control so a browser never serves a ' +
      'stale copy across a login/logout that already invalidated that cache.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved toolset list',
    type: DialToolsetListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to list toolsets',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listToolsets(@Req() req: Request) {
    const { sub, at, bucket } = req.user as SessionUser;
    return this.toolsetsService.listToolsets(sub, at, bucket);
  }

  @Get(':toolsetName')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get toolset by name',
    description:
      'Returns a single DIAL Core toolset by name for the authenticated session user. ' +
      "Proxies GET /openai/toolsets/{toolset_name} using the caller's session access token. " +
      'Results are cached server-side for 60 seconds per user per toolset; ' +
      'the response carries no client-facing Cache-Control so a browser ' +
      'never serves a stale copy across a login/logout that already ' +
      'invalidated that cache.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved toolset',
    type: DialToolsetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid toolset name — disallowed characters',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to access this toolset',
  })
  @ApiResponse({ status: 404, description: 'Toolset not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getToolset(@Req() req: Request, @Param() dto: GetToolsetDto) {
    const { sub, at, bucket } = req.user as SessionUser;
    return this.toolsetsService.getToolset(sub, at, bucket, dto.toolsetName);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createToolset',
    summary: 'Create a new toolset',
    description:
      'Creates a new toolset for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the toolset list cache on success.',
  })
  @ApiBody({ type: ToolsetBodyDto })
  @ApiResponse({
    status: 201,
    description: 'Toolset created successfully',
    type: MutatedToolsetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or invalid fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 409, description: 'Toolset name already taken' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  createToolset(
    @Req() req: Request,
    @Body() body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const { sub, at } = req.user as SessionUser;
    return this.toolsetsService.createToolset(sub, at, body);
  }

  @Patch(':toolsetName')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'updateToolset',
    summary: 'Update a toolset',
    description:
      'Updates an existing toolset for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the relevant caches on success.',
  })
  @ApiBody({ type: ToolsetBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Toolset updated successfully',
    type: MutatedToolsetDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid toolset name or body',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Toolset not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  updateToolset(
    @Req() req: Request,
    @Param() params: GetToolsetDto,
    @Body() body: ToolsetBodyDto,
  ): Promise<MutatedToolsetDto> {
    const { sub, at } = req.user as SessionUser;
    return this.toolsetsService.updateToolset(
      sub,
      at,
      params.toolsetName,
      body,
    );
  }

  @Delete(':toolsetName')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'deleteToolset',
    summary: 'Delete a toolset',
    description:
      'Deletes a toolset for the authenticated session user by proxying DIAL Core. ' +
      'Invalidates the relevant caches on success.',
  })
  @ApiResponse({ status: 204, description: 'Toolset deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid toolset name' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 404, description: 'Toolset not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  deleteToolset(
    @Req() req: Request,
    @Param() params: GetToolsetDto,
  ): Promise<void> {
    const { sub, at } = req.user as SessionUser;
    return this.toolsetsService.deleteToolset(sub, at, params.toolsetName);
  }

  @Post(':toolsetName/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'loginToolset',
    summary: 'Submit toolset credentials',
    description:
      'Submits API key or OAuth authorization-code credentials for a toolset by proxying ' +
      'DIAL Core (POST /v1/ops/toolset/signin). Credential payloads are never logged.',
  })
  @ApiBody({ type: ToolsetLoginBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Credentials submitted successfully',
    type: ToolsetAuthResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid toolset name or body' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async loginToolset(
    @Req() req: Request,
    @Param() params: GetToolsetDto,
    @Body() body: ToolsetLoginBodyDto,
  ): Promise<ToolsetAuthResultDto> {
    const { sub, at } = req.user as SessionUser;
    await this.toolsetsService.loginToolset(sub, at, params.toolsetName, body);
    return { success: true };
  }

  @Post(':toolsetName/logout')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'logoutToolset',
    summary: 'Revoke toolset credentials',
    description:
      "Revokes a toolset's credentials by proxying DIAL Core (POST /v1/ops/toolset/signout). " +
      "When the request body omits `authenticationType`, the toolset's own stored " +
      'authentication type is looked up first (same lookup as `GET /api/v1/toolsets/{toolsetName}`).',
  })
  @ApiBody({ type: ToolsetLogoutBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Credentials revoked successfully',
    type: ToolsetAuthResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid toolset name or body' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({ status: 403, description: 'Caller lacks permission' })
  @ApiResponse({
    status: 404,
    description:
      'Toolset not found (only reachable when `authenticationType` is omitted and the lookup fails)',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  async logoutToolset(
    @Req() req: Request,
    @Param() params: GetToolsetDto,
    @Body() body: ToolsetLogoutBodyDto,
  ): Promise<ToolsetAuthResultDto> {
    const { sub, at, bucket } = req.user as SessionUser;
    await this.toolsetsService.logoutToolset(
      sub,
      at,
      bucket,
      params.toolsetName,
      body,
    );
    return { success: true };
  }
}
