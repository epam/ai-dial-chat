import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { OrgUnitsResponseDto } from './dto/org-unit.dto';
import { OrgUnitsService } from './org-units.service';

@ApiTags('org-units')
@Controller({ path: 'org-units', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.OrgUnitsEnabled)
export class OrgUnitsController {
  constructor(private readonly orgUnitsService: OrgUnitsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listOrgUnits',
    summary: 'List the org units visible to the caller',
    description:
      'Returns the DIAL Core org units the authenticated user may see, flat and parents first. ' +
      '`enabled` is false when DIAL Core has org units turned off. ' +
      'Answers 403 while the `features.orgUnitsEnabled` flag is off. ' +
      'Results are cached server-side for 60 seconds per user.',
  })
  @ApiDialCoreErrors()
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the org units',
    type: OrgUnitsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated — valid session cookie required',
  })
  @ApiResponse({
    status: 403,
    description:
      'The `features.orgUnitsEnabled` flag is off, or DIAL Core refused the org-units read',
  })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description: 'DIAL Core is unavailable or timed out',
  })
  listOrgUnits(@Req() req: Request): Promise<OrgUnitsResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.orgUnitsService.listOrgUnits(sub, at);
  }
}
