import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
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
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
} from './dto/create-scheduled-task.dto';
import { GetScheduledTaskDto } from './dto/get-scheduled-task.dto';
import { ListScheduledTasksResponseDto } from './dto/list-scheduled-tasks.dto';
import { ScheduledTaskDto } from './dto/scheduled-task.dto';
import {
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from './dto/update-scheduled-task.dto';
import { ScheduledTasksService } from './scheduled-tasks.service';

@ApiTags('scheduled-tasks')
@Controller({ path: 'scheduled-tasks', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ScheduledTasksEnabled)
export class ScheduledTasksController {
  constructor(private readonly scheduledTasksService: ScheduledTasksService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, max-age=30')
  @ApiOperation({
    operationId: 'listScheduledTasks',
    summary: 'List scheduled tasks',
    description:
      'Returns the DIAL Scheduler schedules visible to the authenticated session user. ' +
      'Proxies the DIAL Scheduler routed-deployment API using the session access token. ' +
      'Results are cached server-side for 30 seconds per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved scheduled task list',
    type: ListScheduledTasksResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  listScheduledTasks(
    @Req() req: Request,
  ): Promise<ListScheduledTasksResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.listScheduledTasks(sub, at);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createScheduledTask',
    summary: 'Create a scheduled task',
    description:
      'Creates a DIAL Scheduler schedule that runs a chat completion on the given model ' +
      "and prompt, using the authenticated session user's dial-oauth credentials. " +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiBody({ type: CreateScheduledTaskBodyDto })
  @ApiResponse({
    status: 201,
    description: 'Scheduled task created successfully',
    type: CreatedScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or invalid fields',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  createScheduledTask(
    @Req() req: Request,
    @Body() body: CreateScheduledTaskBodyDto,
  ): Promise<CreatedScheduledTaskDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.createScheduledTask(sub, at, body);
  }

  @Get(':scheduleId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    operationId: 'getScheduledTask',
    summary: 'Get a scheduled task by id',
    description:
      'Returns a single DIAL Scheduler schedule by id, proxying DIAL Scheduler using the ' +
      "session user's access token. Not cached.",
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the scheduled task',
    type: ScheduledTaskDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid scheduleId' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  getScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
  ): Promise<ScheduledTaskDto> {
    const { at } = req.user as SessionUser;
    return this.scheduledTasksService.getScheduledTask(at, params.scheduleId);
  }

  @Put(':scheduleId')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'updateScheduledTask',
    summary: 'Update a scheduled task',
    description:
      'Updates an existing DIAL Scheduler schedule for the authenticated session user. ' +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiBody({ type: UpdateScheduledTaskBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task updated successfully',
    type: UpdatedScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid scheduleId or body fields',
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description: 'DIAL Core returned an error response',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  updateScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
    @Body() body: UpdateScheduledTaskBodyDto,
  ): Promise<UpdatedScheduledTaskDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.updateScheduledTask(
      sub,
      at,
      params.scheduleId,
      body,
    );
  }
}
