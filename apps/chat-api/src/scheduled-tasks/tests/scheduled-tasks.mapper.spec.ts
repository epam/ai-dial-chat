import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CreateScheduledTaskBodyDto } from '../dto/create-scheduled-task.dto';
import {
  buildScheduledTaskChatCompletionUrl,
  fromUpstreamSchedule,
  toUpstreamSchedulePayload,
  type UpstreamScheduleResponse,
} from '../scheduled-tasks.mapper';

const DIAL_CORE_URL = 'http://dial-core';
/*
 * Matches DialClientService's DIAL_API_VERSION fallback, so this fixture
 * stays representative of what the mapper actually receives in production.
 */
const DIAL_API_VERSION = '2024-10-21';
const SCHEDULER_SERVICE_ID = 'my-oauth-service';

describe('buildScheduledTaskChatCompletionUrl', () => {
  it('appends /openai to a base URL with no trailing slash', () => {
    expect(buildScheduledTaskChatCompletionUrl('http://core')).toBe(
      'http://core/openai',
    );
  });

  it('strips a trailing slash before appending /openai', () => {
    expect(buildScheduledTaskChatCompletionUrl('http://core/')).toBe(
      'http://core/openai',
    );
  });

  it('does not double up an already-present /openai suffix path', () => {
    expect(buildScheduledTaskChatCompletionUrl('http://core/openai')).toBe(
      'http://core/openai/openai',
    );
  });
});

describe('toUpstreamSchedulePayload', () => {
  it('builds the fixed chat_completion body for a date trigger, using the configured service_id', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Summarize my inbox',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream).toEqual({
      display_name: 'Daily summary',
      service_id: SCHEDULER_SERVICE_ID,
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      properties: {
        target_type: 'chat_completion',
        url: 'http://dial-core/openai',
        api_version: DIAL_API_VERSION,
        create_conversation: true,
        stream: false,
        extra_headers: {},
        retry: null,
        timeout: null,
        payload: {
          messages: [{ role: 'user', content: 'Summarize my inbox' }],
          model: 'gpt-4.1-mini-2025-04-14',
        },
      },
    });
  });

  it('builds the fixed body for a cron trigger', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Hourly check',
      trigger: { cron: { fields: { minute: '0', hour: '*' } } },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Run health check',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream.trigger).toEqual({
      cron: { fields: { minute: '0', hour: '*' } },
    });
    expect(upstream.properties.stream).toBe(false);
    expect(upstream.properties.create_conversation).toBe(true);
    expect(upstream.properties.extra_headers).toEqual({});
    expect(upstream.properties.retry).toBeNull();
    expect(upstream.properties.timeout).toBeNull();
    expect(upstream.properties.payload).not.toHaveProperty('stream');
  });

  it('rejects a trigger with both date and cron', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bad trigger',
      trigger: {
        date: '2026-07-24T09:00:00.000Z',
        cron: { fields: { minute: '0' } },
      },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'x',
    };

    expect(() =>
      toUpstreamSchedulePayload(
        body,
        DIAL_CORE_URL,
        DIAL_API_VERSION,
        SCHEDULER_SERVICE_ID,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a trigger with neither date nor cron', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bad trigger',
      trigger: {},
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'x',
    };

    expect(() =>
      toUpstreamSchedulePayload(
        body,
        DIAL_CORE_URL,
        DIAL_API_VERSION,
        SCHEDULER_SERVICE_ID,
      ),
    ).toThrow(BadRequestException);
  });

  it('includes a top-level description when provided, never nested under properties', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Summarize my inbox',
      description: 'Summarizes unread inbox items every morning',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream.description).toBe(
      'Summarizes unread inbox items every morning',
    );
    expect(
      (upstream.properties as Record<string, unknown>).description,
    ).toBeUndefined();
  });

  it('includes start_date/end_date in the upstream cron when both are provided', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bounded schedule',
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0' },
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.999Z',
        },
      },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Run health check',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream.trigger).toEqual({
      cron: {
        fields: { hour: '9', minute: '0' },
        start_date: '2026-08-01T00:00:00.000Z',
        end_date: '2026-12-31T23:59:59.999Z',
      },
    });
  });

  it('omits start_date/end_date from the upstream cron when neither is provided', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Unbounded schedule',
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Run health check',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream.trigger).toEqual({
      cron: { fields: { hour: '9', minute: '0' } },
    });
    expect(upstream.trigger.cron).not.toHaveProperty('start_date');
    expect(upstream.trigger.cron).not.toHaveProperty('end_date');
  });

  it('rejects a cron window where endDate is not after startDate', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bad window',
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0' },
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
        },
      },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'x',
    };

    expect(() =>
      toUpstreamSchedulePayload(
        body,
        DIAL_CORE_URL,
        DIAL_API_VERSION,
        SCHEDULER_SERVICE_ID,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a cron window where endDate is before startDate', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bad window',
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0' },
          startDate: '2026-08-31T00:00:00.000Z',
          endDate: '2026-08-01T00:00:00.000Z',
        },
      },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'x',
    };

    expect(() =>
      toUpstreamSchedulePayload(
        body,
        DIAL_CORE_URL,
        DIAL_API_VERSION,
        SCHEDULER_SERVICE_ID,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects startDate/endDate combined with a date trigger', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Bad trigger',
      trigger: {
        date: '2026-07-24T09:00:00.000Z',
        cron: {
          fields: {},
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-31T00:00:00.000Z',
        },
      },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'x',
    };

    expect(() =>
      toUpstreamSchedulePayload(
        body,
        DIAL_CORE_URL,
        DIAL_API_VERSION,
        SCHEDULER_SERVICE_ID,
      ),
    ).toThrow(BadRequestException);
  });

  it('omits description from the upstream payload when not provided', () => {
    const body: CreateScheduledTaskBodyDto = {
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      model: 'gpt-4.1-mini-2025-04-14',
      prompt: 'Summarize my inbox',
    };

    const upstream = toUpstreamSchedulePayload(
      body,
      DIAL_CORE_URL,
      DIAL_API_VERSION,
      SCHEDULER_SERVICE_ID,
    );

    expect(upstream.description).toBeUndefined();
  });
});

describe('fromUpstreamSchedule', () => {
  it('maps snake_case upstream fields to a camelCase ScheduledTaskDto', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_123',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      service_id: 'dial-oauth',
    };

    expect(fromUpstreamSchedule(upstream)).toEqual({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z', cron: undefined },
      serviceId: 'dial-oauth',
      isActive: false,
    });
  });

  it('maps next_run_time and created_at when present', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_789',
      display_name: 'Weekly digest',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      next_run_time: '2026-07-28T12:00:00.000Z',
      created_at: '2026-07-23T21:27:07.000Z',
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.nextRunTime).toBe('2026-07-28T12:00:00.000Z');
    expect(result.createdAt).toBe('2026-07-23T21:27:07.000Z');
  });

  it('maps updated_at, trigger_type, and created_by when present', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_321',
      display_name: 'Team digest',
      trigger: {},
      trigger_type: 'cron',
      updated_at: '2026-07-24T05:44:20.011023Z',
      created_by: '70e570e9-cc23-4ffd-9182-078d09f116ac',
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.triggerType).toBe('cron');
    expect(result.updatedAt).toBe('2026-07-24T05:44:20.011023Z');
    expect(result.createdBy).toBe('70e570e9-cc23-4ffd-9182-078d09f116ac');
  });

  it('maps upstream cron start_date/end_date to startDate/endDate', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_901',
      display_name: 'Bounded schedule',
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0' },
          start_date: '2026-08-01T00:00:00.000Z',
          end_date: '2026-12-31T23:59:59.999Z',
        },
      },
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.trigger.cron).toEqual({
      fields: { hour: '9', minute: '0' },
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-12-31T23:59:59.999Z',
    });
  });

  it('maps a cron trigger with no start_date/end_date to undefined without throwing', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_902',
      display_name: 'Unbounded schedule',
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.trigger.cron).toEqual({
      fields: { hour: '9', minute: '0' },
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('maps a list item with no trigger field to an undefined cron without throwing', () => {
    const upstream = {
      id: 'sched_903',
      display_name: 'List item',
      trigger_type: 'cron',
    } as unknown as UpstreamScheduleResponse;

    expect(fromUpstreamSchedule(upstream).trigger.cron).toBeUndefined();
  });

  it('maps a response missing optional trigger fields without throwing', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_456',
      display_name: 'Hourly check',
      trigger: { cron: { fields: { minute: '0' } } },
    };

    expect(fromUpstreamSchedule(upstream)).toEqual({
      id: 'sched_456',
      displayName: 'Hourly check',
      trigger: { date: undefined, cron: { fields: { minute: '0' } } },
      isActive: false,
    });
  });

  it('maps description when present', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_555',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      description: 'Summarizes unread inbox items every morning',
    };

    expect(fromUpstreamSchedule(upstream).description).toBe(
      'Summarizes unread inbox items every morning',
    );
  });

  it('maps a response missing description to undefined without throwing', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_556',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
    };

    expect(fromUpstreamSchedule(upstream).description).toBeUndefined();
  });

  it('maps model and prompt from properties.payload when present', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_777',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      properties: {
        payload: {
          model: 'gpt-4.1-mini-2025-04-14',
          messages: [{ role: 'user', content: 'Summarize my inbox' }],
        },
      },
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.model).toBe('gpt-4.1-mini-2025-04-14');
    expect(result.prompt).toBe('Summarize my inbox');
  });

  it('maps a response missing properties.payload without throwing', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_778',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.model).toBeUndefined();
    expect(result.prompt).toBeUndefined();
  });

  it('maps a response with properties.payload but no messages without throwing', () => {
    const upstream: UpstreamScheduleResponse = {
      id: 'sched_779',
      display_name: 'Daily summary',
      trigger: { date: '2026-07-24T09:00:00.000Z' },
      properties: { payload: { model: 'gpt-4.1-mini-2025-04-14' } },
    };

    const result = fromUpstreamSchedule(upstream);

    expect(result.model).toBe('gpt-4.1-mini-2025-04-14');
    expect(result.prompt).toBeUndefined();
  });

  describe('isActive derivation', () => {
    it('maps a schedule with a future next run to isActive true', () => {
      const upstream: UpstreamScheduleResponse = {
        id: 'sched_901',
        display_name: 'Daily summary',
        trigger_type: 'cron',
        next_run_time: '2026-07-28T12:00:00.000Z',
      };

      expect(fromUpstreamSchedule(upstream).isActive).toBe(true);
    });

    it('maps a paused recurring schedule (no next run) to isActive false', () => {
      const upstream: UpstreamScheduleResponse = {
        id: 'sched_902',
        display_name: 'Paused digest',
        trigger_type: 'cron',
        next_run_time: undefined,
      };

      expect(fromUpstreamSchedule(upstream).isActive).toBe(false);
    });

    it('leaves isActive undefined without throwing when trigger and trigger_type are both absent', () => {
      const upstream: UpstreamScheduleResponse = {
        id: 'sched_903',
        display_name: 'Unknown shape',
      };

      expect(() => fromUpstreamSchedule(upstream)).not.toThrow();
      expect(fromUpstreamSchedule(upstream).isActive).toBeUndefined();
    });
  });
});
