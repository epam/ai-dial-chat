import { Body, Controller, Get, HttpCode, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { UpdateInstalledDto } from './dto/update-installed.dto';
import { UpdatePinsDto } from './dto/update-pins.dto';
import { UserConfigDto } from './dto/user-config.dto';
import { UserConfigService } from './user-config.service';

@ApiTags('user-config')
@Controller({ path: 'user-config', version: '1' })
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user configuration' })
  @ApiResponse({
    status: 200,
    description: 'User configuration',
    type: UserConfigDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getUserConfig(@Req() req: Request): Promise<UserConfigDto> {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.readConfig(at, bucket);
  }

  @Patch('pins')
  @HttpCode(204)
  @ApiOperation({ summary: 'Pin or unpin a conversation' })
  @ApiResponse({ status: 204, description: 'Pin state updated' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updatePin(@Req() req: Request, @Body() dto: UpdatePinsDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updatePin(dto.path, dto.isPinned, at, bucket);
  }

  @Patch('toolsets')
  @HttpCode(204)
  @ApiOperation({ summary: 'Install or uninstall a toolset' })
  @ApiResponse({ status: 204, description: 'Toolset install state updated' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateInstalledToolset(@Req() req: Request, @Body() dto: UpdateInstalledDto) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updateInstalledToolset(
      dto.id,
      dto.isInstalled,
      at,
      bucket,
    );
  }

  @Patch('deployments')
  @HttpCode(204)
  @ApiOperation({ summary: 'Install or uninstall a deployment' })
  @ApiResponse({ status: 204, description: 'Deployment install state updated' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateInstalledDeployment(
    @Req() req: Request,
    @Body() dto: UpdateInstalledDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updateInstalledDeployment(
      dto.id,
      dto.isInstalled,
      at,
      bucket,
    );
  }
}
