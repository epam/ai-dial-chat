import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import {
  ExternalServiceAuthResultDto,
  ExternalServiceLogoutBodyDto,
  ExternalServiceSigninBodyDto,
  GetExternalServiceResponseDto,
} from './dto/external-service.dto';
import { GetExternalServiceDto } from './dto/get-external-service.dto';
import { ExternalServicesService } from './external-services.service';

@ApiTags('external-services')
@Controller({ path: 'external-services', version: '1' })
export class ExternalServicesController {
  constructor(
    private readonly externalServicesService: ExternalServicesService,
  ) {}

  @Get(':appId/:serviceId')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.LiveChatInteraction)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getExternalService',
    summary: 'Get application external-service metadata',
    description:
      "Returns an application external service's display metadata and " +
      'authentication type by proxying DIAL Core ' +
      '(GET /v1/applications/{appId}/external-services/{id}) using the ' +
      "caller's session access token.",
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved external-service metadata',
    type: GetExternalServiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid appId or serviceId — disallowed characters',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or the liveChatInteraction feature is not enabled',
  })
  @ApiResponse({ status: 404, description: 'External service not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  getExternalService(
    @Req() req: Request,
    @Param() params: GetExternalServiceDto,
  ): Promise<GetExternalServiceResponseDto> {
    const { at } = req.user as SessionUser;
    return this.externalServicesService.getExternalService(
      at,
      params.appId,
      params.serviceId,
    );
  }

  @Post(':appId/:serviceId/signin')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.LiveChatInteraction)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'signInExternalService',
    summary: 'Submit external-service credentials',
    description:
      'Submits API key or OAuth authorization-code credentials for an ' +
      'application external service by proxying DIAL Core ' +
      '(POST /v1/ops/external-service/signin). Credential payloads are never logged.',
  })
  @ApiBody({ type: ExternalServiceSigninBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Credentials submitted successfully',
    type: ExternalServiceAuthResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid path segments or body' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or the liveChatInteraction feature is not enabled',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response or rejected sign-in',
  })
  async signIn(
    @Req() req: Request,
    @Param() params: GetExternalServiceDto,
    @Body() body: ExternalServiceSigninBodyDto,
  ): Promise<ExternalServiceAuthResultDto> {
    const { at } = req.user as SessionUser;
    await this.externalServicesService.signIn(
      at,
      params.appId,
      params.serviceId,
      body,
    );
    return { success: true };
  }

  @Post(':appId/:serviceId/signout')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.LiveChatInteraction)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'signOutExternalService',
    summary: 'Revoke external-service credentials',
    description:
      "Revokes an application external service's credentials by proxying " +
      'DIAL Core (POST /v1/ops/external-service/signout). A Core 404 ' +
      '(nothing to revoke) is treated as idempotent success.',
  })
  @ApiBody({ type: ExternalServiceLogoutBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Credentials revoked successfully',
    type: ExternalServiceAuthResultDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid path segments or body' })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or the liveChatInteraction feature is not enabled',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  async signOut(
    @Req() req: Request,
    @Param() params: GetExternalServiceDto,
    @Body() body: ExternalServiceLogoutBodyDto,
  ): Promise<ExternalServiceAuthResultDto> {
    const { at } = req.user as SessionUser;
    await this.externalServicesService.signOut(
      at,
      params.appId,
      params.serviceId,
      body,
    );
    return { success: true };
  }
}
