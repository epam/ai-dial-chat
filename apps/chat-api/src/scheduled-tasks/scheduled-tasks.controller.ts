import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import { ListScheduledTaskRunsResponseDto } from './dto/list-scheduled-task-runs.dto';
import { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
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
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listScheduledTasks',
    summary: 'List scheduled tasks',
    description:
      'Returns the DIAL Scheduler schedules visible to the authenticated session user. ' +
      'Proxies the DIAL Scheduler routed-deployment API using the session access token. ' +
      'Results are cached server-side for 30 seconds per user.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of scheduled tasks to return.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset of the first scheduled task to return.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Case-insensitive substring match against the scheduled task display name.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved scheduled task list',
    type: ListScheduledTasksResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid limit, offset, or search query parameter',
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
    @Query() query: ListScheduledTasksQueryDto,
  ): Promise<ListScheduledTasksResponseDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.listScheduledTasks(sub, at, query);
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'createScheduledTask',
    summary: 'Create a scheduled task',
    description:
      'Creates a DIAL Scheduler schedule that runs a chat completion on the given model ' +
      'and prompt, using the OAuth external-service id configured via SCHEDULER_SERVICE_ID. ' +
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

  @Get(':scheduleId/runs')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'listScheduledTaskRuns',
    summary: 'List a scheduled task run history',
    description:
      'Returns the paginated run history for a single DIAL Scheduler schedule, proxying ' +
      "DIAL Scheduler using the session user's access token. Always requests upstream " +
      'ordering of created_at desc explicitly. Not cached.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of runs to return.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset of the first run to return.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the scheduled task run history',
    type: ListScheduledTaskRunsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId, limit, or offset',
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
  listScheduledTaskRuns(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
    @Query() query: ListScheduledTaskRunsQueryDto,
  ): Promise<ListScheduledTaskRunsResponseDto> {
    const { at } = req.user as SessionUser;
    return this.scheduledTasksService.listScheduledTaskRuns(
      at,
      params.scheduleId,
      query,
    );
  }

  @Post(':scheduleId/pause')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'pauseScheduledTask',
    summary: 'Pause a scheduled task',
    description:
      'Pauses a DIAL Scheduler schedule for the authenticated session user. ' +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task paused successfully',
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
  pauseScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
  ): Promise<ScheduledTaskDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.pauseScheduledTask(
      sub,
      at,
      params.scheduleId,
    );
  }

  @Post(':scheduleId/resume')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'resumeScheduledTask',
    summary: 'Resume a scheduled task',
    description:
      'Resumes a paused DIAL Scheduler schedule for the authenticated session ' +
      'user. Invalidates the scheduled tasks list cache on success.',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task resumed successfully',
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
  resumeScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
  ): Promise<ScheduledTaskDto> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.resumeScheduledTask(
      sub,
      at,
      params.scheduleId,
    );
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

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'deleteScheduledTask',
    summary: 'Delete a scheduled task',
    description:
      'Deletes a DIAL Scheduler schedule for the authenticated session user. ' +
      'DIAL Scheduler alone decides whether the schedule is hard-deleted (no run ' +
      'history) or soft-deleted (is_deleted: true, run history preserved) — the BFF ' +
      'never predicts or requests a specific outcome. Invalidates the scheduled ' +
      'tasks list cache on success.',
  })
  @ApiResponse({
    status: 204,
    description: 'Scheduled task deleted successfully (empty body)',
  })
  @ApiResponse({ status: 400, description: 'Invalid scheduleId' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({
    status: 404,
    description:
      'Scheduled task not found, owned by another user, or already hard-deleted',
  })
  @ApiResponse({
    status: 409,
    description: 'Scheduled task is already soft-deleted',
  })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  @ApiResponse({
    status: 502,
    description:
      'DIAL Scheduler could not unregister the job; no data changed and retrying is safe',
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  deleteScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
  ): Promise<void> {
    const { sub, at } = req.user as SessionUser;
    return this.scheduledTasksService.deleteScheduledTask(
      sub,
      at,
      params.scheduleId,
    );
  }
}
