import { BadRequestException } from '@nestjs/common';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type {
  ScheduleCronDto,
  ScheduleTriggerDto,
} from './dto/schedule-trigger.dto';
import {
  type ScheduledTaskRunDto,
  ScheduledTaskRunStatus,
} from './dto/scheduled-task-run.dto';
import type {
  ScheduledTaskDto,
  ScheduleTriggerType,
} from './dto/scheduled-task.dto';

interface UpstreamScheduleTrigger {
  date?: string;
  cron?: {
    fields: Record<string, string>;
    start_date?: string;
    end_date?: string;
  };
}

interface UpstreamSchedulePayload {
  display_name: string;
  service_id: string;
  trigger: UpstreamScheduleTrigger;
  /*
   * Not confirmed against a live DIAL Scheduler response or its
   * openapi.json — assumed to mirror display_name/service_id as a
   * top-level field per design.md. Verify before relying on this in
   * production and update this comment once confirmed.
   */
  description?: string;
  properties: {
    target_type: 'chat_completion';
    url: string;
    api_version: string;
    create_conversation: true;
    stream: false;
    extra_headers: Record<string, never>;
    retry: null;
    timeout: null;
    payload: {
      messages: { role: 'user'; content: string }[];
      model: string;
    };
  };
}

export interface UpstreamScheduleResponse {
  id: string;
  display_name: string;
  trigger: UpstreamScheduleTrigger;
  next_run_time?: string;
  created_at?: string;
  updated_at?: string;
  /*
   * List items only carry `trigger_type` (no nested `trigger`); `trigger`
   * above is populated for shapes that do include it (e.g. create/update
   * responses), so both are read here rather than picking one.
   */
  trigger_type?: string;
  service_id?: string;
  created_by?: string;
  description?: string;
  properties?: {
    payload?: {
      model?: string;
      messages?: { role: string; content: string }[];
    };
  };
  [key: string]: unknown;
}

/*
 * DIAL Scheduler only allows exactly one trigger variant per schedule, and the
 * start_date/end_date activity window only applies to a cron trigger — both
 * invariants can't be expressed declaratively with class-validator across two
 * optional sibling fields, so they're enforced here and covered by mapper
 * unit tests instead.
 */
const assertExactlyOneTriggerVariant = (trigger: ScheduleTriggerDto): void => {
  const hasDate = trigger.date != null;
  const hasCron = trigger.cron != null;
  if (hasDate === hasCron) {
    throw new BadRequestException(
      'trigger must specify exactly one of "date" or "cron"',
    );
  }
};

const assertValidCronWindow = (cron: ScheduleCronDto | undefined): void => {
  if (cron?.startDate == null || cron?.endDate == null) {
    return;
  }
  if (new Date(cron.endDate).getTime() <= new Date(cron.startDate).getTime()) {
    throw new BadRequestException(
      'trigger.cron.endDate must be strictly after trigger.cron.startDate',
    );
  }
};

const toUpstreamTrigger = (
  trigger: ScheduleTriggerDto,
): UpstreamScheduleTrigger => {
  assertExactlyOneTriggerVariant(trigger);
  if (trigger.date != null) {
    return { date: trigger.date };
  }
  assertValidCronWindow(trigger.cron);
  return {
    cron: {
      fields: trigger.cron?.fields ?? {},
      ...(trigger.cron?.startDate
        ? { start_date: trigger.cron.startDate }
        : {}),
      ...(trigger.cron?.endDate ? { end_date: trigger.cron.endDate } : {}),
    },
  };
};

/*
 * DIAL Core's base URL may or may not carry a trailing slash depending on
 * how DIAL_CORE_URL is configured — normalize it here so the upstream Scheduler
 * call never ends up with a double slash before /openai.
 */
export const buildScheduledTaskChatCompletionUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/openai`;

export const toUpstreamSchedulePayload = (
  body: CreateScheduledTaskBodyDto,
  dialCoreUrl: string,
  dialApiVersion: string,
  serviceId: string,
): UpstreamSchedulePayload => ({
  display_name: body.displayName,
  service_id: serviceId,
  trigger: toUpstreamTrigger(body.trigger),
  ...(body.description ? { description: body.description } : {}),
  properties: {
    target_type: 'chat_completion',
    url: buildScheduledTaskChatCompletionUrl(dialCoreUrl),
    api_version: dialApiVersion,
    create_conversation: true,
    stream: false,
    extra_headers: {},
    retry: null,
    timeout: null,
    payload: {
      messages: [{ role: 'user', content: body.prompt }],
      model: body.model,
    },
  },
});

export const fromUpstreamSchedule = (
  upstream: UpstreamScheduleResponse,
): ScheduledTaskDto => ({
  id: upstream.id,
  displayName: upstream.display_name,
  trigger: {
    date: upstream.trigger?.date,
    cron: upstream.trigger?.cron
      ? {
          fields: upstream.trigger.cron.fields,
          startDate: upstream.trigger.cron.start_date,
          endDate: upstream.trigger.cron.end_date,
        }
      : undefined,
  },
  nextRunTime: upstream.next_run_time,
  createdAt: upstream.created_at,
  updatedAt: upstream.updated_at,
  triggerType: upstream.trigger_type as ScheduleTriggerType | undefined,
  serviceId: upstream.service_id,
  createdBy: upstream.created_by,
  description: upstream.description,
  model: upstream.properties?.payload?.model,
  prompt: upstream.properties?.payload?.messages?.[0]?.content,
});

export interface UpstreamScheduleRun {
  id: string;
  status: 'success' | 'error' | 'in_progress' | 'missed' | string;
  start_time: string;
  end_time?: string | null;
}

const UPSTREAM_RUN_STATUS_MAP: Record<string, ScheduledTaskRunStatus> = {
  success: ScheduledTaskRunStatus.Success,
  error: ScheduledTaskRunStatus.Error,
  in_progress: ScheduledTaskRunStatus.InProgress,
  missed: ScheduledTaskRunStatus.Missed,
};

const deriveDurationSeconds = (
  startTime: string,
  endTime: string | null | undefined,
): number | undefined => {
  if (!endTime) return undefined;
  const durationMs =
    new Date(endTime).getTime() - new Date(startTime).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return undefined;
  return Math.round(durationMs / 1000);
};

export const fromUpstreamRun = (
  upstream: UpstreamScheduleRun,
): ScheduledTaskRunDto => ({
  id: upstream.id,
  status:
    UPSTREAM_RUN_STATUS_MAP[upstream.status] ?? ScheduledTaskRunStatus.Missed,
  startTime: upstream.start_time,
  endTime: upstream.end_time,
  durationSeconds: deriveDurationSeconds(
    upstream.start_time,
    upstream.end_time,
  ),
});
