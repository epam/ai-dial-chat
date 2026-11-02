import { BadRequestException } from '@nestjs/common';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { StringUtils } from '../common/utils/string-utils';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type {
  ScheduleCronDto,
  ScheduleTriggerDto,
} from './dto/schedule-trigger.dto';
import {
  type ScheduledTaskRunDto,
  ScheduledTaskRunStatus,
} from './dto/scheduled-task-run.dto';
import type { ScheduledTaskDto } from './dto/scheduled-task.dto';
import { ScheduleTriggerType } from './dto/scheduled-task.dto';

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
   * top-level field per `openspec/changes/archive/2026-07-23-add-scheduled-tasks-api/design.md`. Verify before relying on this in
   * production and update this comment once confirmed.
   */
  description?: string;
  properties: {
    target_type: 'chat_completion';
    url: string;
    api_version: string;
    create_conversation: true;
    extra_headers: Record<string, never>;
    retry: null;
    timeout: null;
    payload: {
      stream: true;
      messages: {
        role: 'user';
        content: string;
        custom_content?: { skills: { url: string }[] };
      }[];
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
   * List items only carry `trigger_type` (no nested `trigger`); GET responses
   * carry the nested `trigger` with no `trigger_type`, and create/update
   * responses carry both — so `triggerType` is derived from whichever source
   * is present (see `deriveTriggerType`).
   */
  trigger_type?: string;
  service_id?: string;
  created_by?: string;
  description?: string;
  /*
   * List items expose the model as a top-level field (no nested
   * `properties`); GET/create/update responses carry it under
   * `properties.payload.model` — see `fromUpstreamSchedule`.
   */
  model?: string;
  is_deleted?: boolean;
  properties?: {
    payload?: {
      model?: string;
      messages?: {
        role: string;
        content: string;
        custom_content?: { skills?: { url: string }[] };
      }[];
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
  `${StringUtils.stripTrailingSlashes(baseUrl)}/openai`;

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
    extra_headers: {},
    retry: null,
    timeout: null,
    payload: {
      stream: true,
      messages: [
        {
          role: 'user',
          content: body.prompt,
          ...(body.skillUrls?.length
            ? {
                custom_content: {
                  skills: [...new Set(body.skillUrls)].map((url) => ({
                    url: encodeDialResourcePath(url),
                  })),
                },
              }
            : {}),
        },
      ],
      model: body.model,
    },
  },
});

/*
 * No upstream field documenting an explicit active/paused state has been
 * confirmed against a live DIAL Scheduler response or its OpenAPI spec (see
 * `openspec/changes/archive/2026-08-11-add-scheduled-task-active-toggle/design.md` "Decision 1" / "Open Questions" for add-scheduled-task-active-toggle).
 * This derives isActive from the only currently observed signal —
 * next_run_time — as a documented assumption, not a confirmed contract.
 * Replace with an authoritative upstream field here (and only here) once
 * confirmed; do not silently swap in a different undocumented heuristic.
 */
const deriveIsActive = (
  upstream: UpstreamScheduleResponse,
): boolean | undefined => {
  if (upstream.trigger == null && upstream.trigger_type == null) {
    return undefined;
  }
  return upstream.next_run_time != null;
};

/*
 * List responses carry `trigger_type` but no nested `trigger`; GET responses
 * (observed live) carry the nested `trigger` with no `trigger_type`. Derive
 * the trigger kind from whichever source is present so the DTO always names
 * it — the completed-state derivation and the detail page's field fallbacks
 * both branch on `triggerType`.
 */
const deriveTriggerType = (
  upstream: UpstreamScheduleResponse,
): ScheduleTriggerType | undefined => {
  if (upstream.trigger?.cron != null) {
    return ScheduleTriggerType.Cron;
  }
  if (upstream.trigger?.date != null) {
    return ScheduleTriggerType.Date;
  }
  return upstream.trigger_type as ScheduleTriggerType | undefined;
};

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
  triggerType: deriveTriggerType(upstream),
  isActive: deriveIsActive(upstream),
  isDeleted: upstream.is_deleted ?? false,
  serviceId: upstream.service_id,
  createdBy: upstream.created_by,
  description: upstream.description,
  model: upstream.model ?? upstream.properties?.payload?.model,
  prompt: upstream.properties?.payload?.messages?.[0]?.content,
  skillUrls:
    upstream.properties?.payload?.messages?.[0]?.custom_content?.skills?.map(
      (skill) => skill.url,
    ) ?? (upstream.properties?.payload ? [] : undefined),
});

export interface UpstreamScheduleRun {
  id: string;
  status: 'success' | 'error' | 'in_progress' | 'missed' | string;
  start_time: string;
  end_time?: string | null;
  conversation_id?: string | null;
  result?:
    | ({ stage?: unknown; error_text?: unknown } & Record<string, unknown>)
    | null;
}

/* Scheduler's error_text is a raw exception string; cap what reaches the client. */
const RUN_ERROR_TEXT_MAX_LENGTH = 1000;

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
): ScheduledTaskRunDto => {
  const resultStage = upstream.result?.stage;
  const rawErrorText = upstream.result?.error_text;
  const errorText =
    typeof rawErrorText === 'string'
      ? rawErrorText.trim().slice(0, RUN_ERROR_TEXT_MAX_LENGTH)
      : undefined;

  return {
    id: upstream.id,
    status:
      UPSTREAM_RUN_STATUS_MAP[upstream.status] ?? ScheduledTaskRunStatus.Missed,
    startTime: upstream.start_time,
    endTime: upstream.end_time,
    durationSeconds: deriveDurationSeconds(
      upstream.start_time,
      upstream.end_time,
    ),
    conversationId: upstream.conversation_id ?? undefined,
    ...(typeof resultStage === 'string' ? { resultStage } : {}),
    ...(errorText ? { errorText } : {}),
  };
};

/*
 * The DIAL Scheduler list endpoint returns a paginated envelope
 * (`{ count, limit, offset, results, next, previous }`), not a bare array
 * or an `{ items }` wrapper — `results` is checked first since it's the
 * shape confirmed against a live instance; `items`/array are kept as
 * fallbacks in case a future Scheduler version changes the envelope.
 */
export const extractScheduleListItems = (
  result: UpstreamScheduleResponse,
): UpstreamScheduleResponse[] => {
  if (Array.isArray(result)) {
    return result as unknown as UpstreamScheduleResponse[];
  }
  const envelope = result as unknown as {
    results?: UpstreamScheduleResponse[];
    items?: UpstreamScheduleResponse[];
  };
  return envelope.results ?? envelope.items ?? [];
};

/*
 * Only present when the upstream response is the paginated envelope
 * (`{ count, limit, offset, results, next, previous }`); a bare array or
 * an `{ items }` fallback shape has none of these, so every field stays
 * `undefined` in that case.
 */
export const extractScheduleListPagination = (
  result: UpstreamScheduleResponse,
): {
  count?: number;
  limit?: number;
  offset?: number;
  next?: string | null;
  previous?: string | null;
} => {
  if (Array.isArray(result)) {
    return {};
  }
  const envelope = result as unknown as {
    count?: number;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  };
  return {
    count: envelope.count,
    limit: envelope.limit,
    offset: envelope.offset,
    next: envelope.next,
    previous: envelope.previous,
  };
};
