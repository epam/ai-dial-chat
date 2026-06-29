import { Controller, Get, Header, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../openapi/openapi-response.dto';
import { GetToolsetDto } from './dto/get-toolset.dto';
import { ToolsetsService } from './toolsets.service';

@ApiTags('toolsets')
@Controller({ path: 'toolsets', version: '1' })
export class ToolsetsController {
  constructor(private readonly toolsetsService: ToolsetsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    summary: 'List available toolsets',
    description:
      'Returns the list of DIAL Core toolsets visible to the authenticated session user. ' +
      "Proxies GET /openai/toolsets using the caller's session access token. " +
      'Results are cached server-side for 30 seconds per user.',
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
    const { sub, at } = req.user as SessionUser;
    return this.toolsetsService.listToolsets(sub, at);
  }

  @Get(':toolsetName')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({
    summary: 'Get toolset by name',
    description:
      'Returns a single DIAL Core toolset by name for the authenticated session user. ' +
      "Proxies GET /openai/toolsets/{toolset_name} using the caller's session access token. " +
      'Results are cached server-side for 60 seconds per user per toolset.',
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
    const { sub, at } = req.user as SessionUser;
    return this.toolsetsService.getToolset(sub, at, dto.toolsetName);
  }
}
