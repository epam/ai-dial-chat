import { Controller, Get, Header, Param, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import {
  DialModelDto,
  DialModelListResponseDto,
} from '../openapi/openapi-response.dto';
import { GetModelDto } from './dto/get-model.dto';
import { ModelsService } from './models.service';

@ApiTags('models')
@Controller({ path: 'models', version: '1' })
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    summary: 'List available models',
    description:
      'Returns the list of DIAL Core deployments visible to the authenticated session user. ' +
      "Proxies GET /openai/models using the caller's session access token. " +
      'Results are cached server-side for 30 seconds per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved model list',
    type: DialModelListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to list models',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listModels(@Req() req: Request) {
    const { sub, at } = req.user as SessionUser;
    return this.modelsService.listModels(sub, at);
  }

  @Get(':modelName')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({
    summary: 'Get model by name',
    description:
      'Returns a single DIAL Core deployment by name for the authenticated session user. ' +
      "Proxies GET /openai/models/{model_name} using the caller's session access token. " +
      'Results are cached server-side for 60 seconds per user per model.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved model',
    type: DialModelDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid model name — disallowed characters',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description: 'Caller lacks permission to access this model',
  })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  getModel(@Req() req: Request, @Param() dto: GetModelDto) {
    const { sub, at } = req.user as SessionUser;
    return this.modelsService.getModel(sub, at, dto.modelName);
  }
}
