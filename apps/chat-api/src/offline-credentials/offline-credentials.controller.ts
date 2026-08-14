import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsAuthResultDto,
  OfflineCredentialsSigninBodyDto,
} from './dto/offline-credentials.dto';
import { OfflineCredentialsService } from './offline-credentials.service';

/*
 * `@UseGuards(FeatureGuard)`/`@RequireFeature(...)` are applied per-handler
 * rather than at the class level: `FeatureGuard` reads metadata via
 * `Reflector.get(FEATURE_KEY_METADATA, executionContext.getHandler())`,
 * which only inspects the specific route-handler function
 * (`SetMetadata`'s method-decorator branch writes to `descriptor.value`).
 * A class-level `@RequireFeature` writes metadata onto the controller class
 * constructor instead, which `getHandler()` never sees, so the guard
 * silently no-ops (confirmed empirically against this exact `FeatureGuard`
 * implementation). Per-handler placement (mirroring
 * `ExternalServicesController`) is required for the flag to actually gate
 * these routes.
 */
@ApiTags('offline-credentials')
@Controller({ path: 'offline-credentials', version: '1' })
export class OfflineCredentialsController {
  constructor(
    private readonly offlineCredentialsService: OfflineCredentialsService,
  ) {}

  @Get()
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.ScheduledTasksEnabled)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getOfflineCredentials',
    summary: 'Get offline-credentials status',
    description:
      "Returns the session user's offline-credentials consent status by " +
      'proxying DIAL Core (GET /v1/user/offline-credentials). Never cached.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved offline-credentials status',
    type: GetOfflineCredentialsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or the scheduledTasksEnabled feature is not enabled',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  getOfflineCredentials(
    @Req() req: Request,
  ): Promise<GetOfflineCredentialsResponseDto> {
    const { at } = req.user as SessionUser;
    return this.offlineCredentialsService.getOfflineCredentialsStatus(at);
  }

  @Post('signin')
  @UseGuards(FeatureGuard)
  @RequireFeature(FeatureKey.ScheduledTasksEnabled)
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'signInOfflineCredentials',
    summary: 'Submit offline-credentials OAuth authorization code',
    description:
      'Submits the OAuth authorization code obtained from the ' +
      'offline-credentials consent popup by proxying DIAL Core ' +
      '(POST /v1/user/offline-credentials/signin). The authorization code ' +
      'is never logged.',
  })
  @ApiBody({ type: OfflineCredentialsSigninBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Signed in successfully',
    type: OfflineCredentialsAuthResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid body, or redirectUri is not allowlisted',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'Caller lacks permission, or the scheduledTasksEnabled feature is not enabled',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response or rejected sign-in',
  })
  @ApiResponse({ status: 503, description: 'DIAL Core is unreachable' })
  async signIn(
    @Req() req: Request,
    @Body() body: OfflineCredentialsSigninBodyDto,
  ): Promise<OfflineCredentialsAuthResultDto> {
    const { at } = req.user as SessionUser;
    await this.offlineCredentialsService.signIn(at, body);
    return { success: true };
  }
}
