import { BadRequestException } from '@nestjs/common';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type { ScheduleTriggerDto } from './dto/schedule-trigger.dto';
import type {
  ScheduledTaskDto,
  ScheduleTriggerType,
} from './dto/scheduled-task.dto';

interface UpstreamScheduleTrigger {
  date?: string;
  cron?: { fields: Record<string, string> };
}

interface UpstreamSchedulePayload {
  display_name: string;
  service_id: 'dial-oauth';
  trigger: UpstreamScheduleTrigger;
  properties: {
    target_type: 'chat_completion';
    url: string;
    payload: {
      messages: { role: 'user'; content: string }[];
      model: string;
      stream: boolean;
    };
    api_version: string;
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
  [key: string]: unknown;
}

/*
 * DIAL Scheduler only allows exactly one trigger variant per schedule — this
 * invariant can't be expressed declaratively with class-validator across two
 * optional sibling fields, so it's enforced here and covered by mapper unit
 * tests instead.
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

const toUpstreamTrigger = (
  trigger: ScheduleTriggerDto,
): UpstreamScheduleTrigger => {
  assertExactlyOneTriggerVariant(trigger);
  if (trigger.date != null) {
    return { date: trigger.date };
  }
  return { cron: { fields: trigger.cron?.fields ?? {} } };
};

export const toUpstreamSchedulePayload = (
  body: CreateScheduledTaskBodyDto,
  dialCoreUrl: string,
  dialApiVersion: string,
): UpstreamSchedulePayload => ({
  display_name: body.displayName,
  service_id: 'dial-oauth',
  trigger: toUpstreamTrigger(body.trigger),
  properties: {
    target_type: 'chat_completion',
    url: `${dialCoreUrl}/openai`,
    payload: {
      messages: [{ role: 'user', content: body.prompt }],
      model: body.model,
      stream: body.stream ?? true,
    },
    api_version: dialApiVersion,
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
      ? { fields: upstream.trigger.cron.fields }
      : undefined,
  },
  nextRunTime: upstream.next_run_time,
  createdAt: upstream.created_at,
  updatedAt: upstream.updated_at,
  triggerType: upstream.trigger_type as ScheduleTriggerType | undefined,
  serviceId: upstream.service_id,
  createdBy: upstream.created_by,
});
