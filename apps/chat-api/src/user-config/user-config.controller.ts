import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import { UpdateInstalledPromptDto } from './dto/update-installed-prompt.dto';
import { UpdateInstalledSkillDto } from './dto/update-installed-skill.dto';
import { UpdateInstalledDto } from './dto/update-installed.dto';
import { UpdatePinsDto } from './dto/update-pins.dto';
import { UpdateSelectedDeploymentDto } from './dto/update-selected-deployment.dto';
import { UserConfigDto } from './dto/user-config.dto';
import { UserConfigService } from './user-config.service';

@ApiTags('user-config')
@Controller({ path: 'user-config', version: '1' })
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user configuration' })
  @ApiDialCoreErrors({ exclude: [HttpStatus.NOT_FOUND] })
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
  @ApiDialCoreErrors()
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
  @ApiDialCoreErrors()
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
  @ApiDialCoreErrors()
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

  @Patch('prompts')
  @HttpCode(204)
  @ApiOperation({ summary: 'Add or remove a prompt from favorites' })
  @ApiBody({ type: UpdateInstalledPromptDto })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Prompt favorite state updated' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateInstalledPrompt(
    @Req() req: Request,
    @Body() dto: UpdateInstalledPromptDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updateInstalledPrompt(
      dto.id,
      dto.isInstalled,
      at,
      bucket,
    );
  }

  @Patch('skills')
  @HttpCode(204)
  @ApiOperation({ summary: 'Add or remove a skill from favorites' })
  @ApiBody({ type: UpdateInstalledSkillDto })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Skill favorite state updated' })
  @ApiResponse({ status: 400, description: 'Missing or invalid body' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateInstalledSkill(
    @Req() req: Request,
    @Body() dto: UpdateInstalledSkillDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updateInstalledSkill(
      dto.id,
      dto.isInstalled,
      at,
      bucket,
    );
  }

  @Patch('deployments/selected')
  @HttpCode(204)
  @ApiOperation({ summary: 'Set the selected deployment' })
  @ApiBody({ type: UpdateSelectedDeploymentDto })
  @ApiDialCoreErrors()
  @ApiResponse({ status: 204, description: 'Selected deployment updated' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  updateSelectedDeployment(
    @Req() req: Request,
    @Body() dto: UpdateSelectedDeploymentDto,
  ) {
    const { at, bucket } = req.user as SessionUser;
    return this.userConfigService.updateSelectedDeployment(dto.id, at, bucket);
  }
}
