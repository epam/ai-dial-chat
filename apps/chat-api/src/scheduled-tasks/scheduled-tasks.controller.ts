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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { FeatureGuard } from '../app-config/feature-flags/feature.guard';
import { RequireFeature } from '../app-config/feature-flags/require-feature.decorator';
import type { SessionUser } from '../auth/session/session.types';
import { ApiDialCoreErrors } from '../common/dial/api-dial-core-errors.decorator';
import {
  CreateScheduledTaskBodyDto,
  CreatedScheduledTaskDto,
} from './dto/create-scheduled-task.dto';
import { GetScheduledTaskRunDto } from './dto/get-scheduled-task-run.dto';
import { GetScheduledTaskDto } from './dto/get-scheduled-task.dto';
import { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import { ListScheduledTaskRunsResponseDto } from './dto/list-scheduled-task-runs.dto';
import { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ListScheduledTasksResponseDto } from './dto/list-scheduled-tasks.dto';
import { ScheduledTaskRunDto } from './dto/scheduled-task-run.dto';
import { ScheduledTaskValidationErrorDto } from './dto/scheduled-task-validation-error.dto';
import { ScheduledTaskDto } from './dto/scheduled-task.dto';
import {
  UpdateScheduledTaskBodyDto,
  UpdatedScheduledTaskDto,
} from './dto/update-scheduled-task.dto';
import { ScheduledTaskRateLimitException } from './scheduled-task-rate-limit.exception';
import { ScheduledTasksService } from './scheduled-tasks.service';

@ApiTags('scheduled-tasks')
@Controller({ path: 'scheduled-tasks', version: '1' })
@UseGuards(FeatureGuard)
@RequireFeature(FeatureKey.ScheduledTasksEnabled)
export class ScheduledTasksController {
  constructor(private readonly scheduledTasksService: ScheduledTasksService) {}

  @Get()
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
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved scheduled task list',
    type: ListScheduledTasksResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid limit, offset, or search query parameter',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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
  @ApiOperation({
    operationId: 'createScheduledTask',
    summary: 'Create a scheduled task',
    description:
      'Creates a DIAL Scheduler schedule that runs a chat completion on the given model ' +
      'and prompt or skill, using the OAuth external-service id configured via SCHEDULER_SERVICE_ID. ' +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiBody({ type: CreateScheduledTaskBodyDto })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 201,
    description: 'Scheduled task created successfully',
    type: CreatedScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or invalid fields',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'Feature disabled, selected model is inaccessible, or an administrator revoked the DIAL_NATIVE scheduler consent (code scheduledTaskAdminConsentRequired)',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  @ApiResponse({
    status: 404,
    description: 'Selected model is unavailable',
    type: ScheduledTaskValidationErrorDto,
  })
  createScheduledTask(
    @Req() req: Request,
    @Body() body: CreateScheduledTaskBodyDto,
  ): Promise<CreatedScheduledTaskDto> {
    const { sub, at, bucket } = req.user as SessionUser;
    return this.scheduledTasksService.createScheduledTask(
      sub,
      at,
      body,
      bucket,
    );
  }

  @Get(':scheduleId')
  @ApiOperation({
    operationId: 'getScheduledTask',
    summary: 'Get a scheduled task by id',
    description:
      'Returns a single DIAL Scheduler schedule by id, proxying DIAL Scheduler using the ' +
      "session user's access token. Not cached.",
  })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the scheduled task',
    type: ScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the scheduled task run history',
    type: ListScheduledTaskRunsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId, limit, or offset',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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

  @Get(':scheduleId/runs/:runId')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'getScheduledTaskRun',
    summary: 'Get one scheduled task run',
    description:
      'Returns one DIAL Scheduler run for an owned schedule, proxying the Scheduler using the session access token. Not cached.',
  })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the scheduled task run',
    type: ScheduledTaskRunDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId or runId',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({
    status: 404,
    description:
      'Scheduled task run not found or not owned by the current user',
  })
  @ApiResponse({
    status: 429,
    description: 'DIAL Scheduler rate limited the run status request',
    type: ScheduledTaskValidationErrorDto,
    headers: {
      'Retry-After': {
        description:
          'Scheduler retry delay in seconds or an HTTP date, when supplied.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  async getScheduledTaskRun(
    @Req() req: Request,
    @Param() params: GetScheduledTaskRunDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ScheduledTaskRunDto> {
    const { at } = req.user as SessionUser;
    try {
      return await this.scheduledTasksService.getScheduledTaskRun(
        at,
        params.scheduleId,
        params.runId,
      );
    } catch (error) {
      if (
        error instanceof ScheduledTaskRateLimitException &&
        error.retryAfter
      ) {
        response.setHeader('Retry-After', error.retryAfter);
      }
      throw error;
    }
  }

  @Post(':scheduleId/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    operationId: 'startScheduledTask',
    summary: 'Start a scheduled task immediately',
    description:
      'Starts the saved DIAL Scheduler definition immediately for the authenticated session user. ' +
      'The request has no body, does not wait for completion, and does not change the schedule.',
  })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 202,
    description: 'Scheduled task run accepted',
    type: ScheduledTaskRunDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user or the request failed CSRF validation',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduled task not found or not owned by the current user',
  })
  @ApiResponse({
    status: 409,
    description: 'Scheduled task is soft-deleted and cannot be started',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 429,
    description: 'DIAL Scheduler rate limited the start request',
    type: ScheduledTaskValidationErrorDto,
    headers: {
      'Retry-After': {
        description:
          'Scheduler retry delay in seconds or an HTTP date, when supplied.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 503,
    description:
      'DIAL Core is unavailable, timed out, or SCHEDULER_APP_ID is not configured',
  })
  async startScheduledTask(
    @Req() req: Request,
    @Param() params: GetScheduledTaskDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ScheduledTaskRunDto> {
    const { at } = req.user as SessionUser;
    try {
      return await this.scheduledTasksService.startScheduledTask(
        at,
        params.scheduleId,
      );
    } catch (error) {
      if (
        error instanceof ScheduledTaskRateLimitException &&
        error.retryAfter
      ) {
        response.setHeader('Retry-After', error.retryAfter);
      }
      throw error;
    }
  }

  @Post(':scheduleId/pause')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'pauseScheduledTask',
    summary: 'Pause a scheduled task',
    description:
      'Pauses a DIAL Scheduler schedule for the authenticated session user. ' +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task paused successfully',
    type: ScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'The scheduledTasksEnabled feature is not enabled for this user',
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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
  @ApiOperation({
    operationId: 'resumeScheduledTask',
    summary: 'Resume a scheduled task',
    description:
      'Resumes a paused DIAL Scheduler schedule for the authenticated session ' +
      'user. Invalidates the scheduled tasks list cache on success.',
  })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task resumed successfully',
    type: ScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'Feature disabled, or an administrator revoked the DIAL_NATIVE scheduler consent (code scheduledTaskAdminConsentRequired)',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 404, description: 'Scheduled task not found' })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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
  @ApiOperation({
    operationId: 'updateScheduledTask',
    summary: 'Update a scheduled task',
    description:
      'Updates an existing DIAL Scheduler schedule for the authenticated session user. ' +
      'Omitting skillUrls preserves saved references; [] removes them. ' +
      'Invalidates the scheduled tasks list cache on success.',
  })
  @ApiBody({ type: UpdateScheduledTaskBodyDto })
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task updated successfully',
    type: UpdatedScheduledTaskDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — invalid scheduleId or body fields',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({
    status: 403,
    description:
      'Feature disabled, selected model is inaccessible, or an administrator revoked the DIAL_NATIVE scheduler consent (code scheduledTaskAdminConsentRequired)',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'Scheduled task or selected model not found; deployment errors carry scheduledTaskDeploymentUnavailable',
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 502,
    description:
      "DIAL Core returned an error response (upstreamMessage/upstreamCode carry DIAL Scheduler's own reason and code when supplied)",
    type: ScheduledTaskValidationErrorDto,
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
    const { sub, at, bucket } = req.user as SessionUser;
    return this.scheduledTasksService.updateScheduledTask(
      sub,
      at,
      params.scheduleId,
      body,
      bucket,
    );
  }

  @Delete(':scheduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  @ApiDialCoreErrors({ errorType: ScheduledTaskValidationErrorDto })
  @ApiResponse({
    status: 204,
    description: 'Scheduled task deleted successfully (empty body)',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid scheduleId',
    type: ScheduledTaskValidationErrorDto,
  })
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
    type: ScheduledTaskValidationErrorDto,
  })
  @ApiResponse({
    status: 502,
    description:
      'DIAL Scheduler could not unregister the job; no data changed and retrying is safe',
    type: ScheduledTaskValidationErrorDto,
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
