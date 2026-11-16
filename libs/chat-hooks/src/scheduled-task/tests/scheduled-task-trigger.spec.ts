import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedTriggerReason } from '../scheduled-task-mapping';
import {
  mapFormValuesToCreateBody,
  mapFormValuesToUpdateBody,
  mapScheduledTaskDtoToFormValues,
} from '../scheduled-task-trigger';

const baseDto: ScheduledTaskDto = {
  id: 'sched_123',
  displayName: 'Daily summary',
  model: 'gpt-4o',
  prompt: 'Summarize my inbox',
  timezone: 'Europe/Berlin',
  trigger: {},
};

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: 'Daily summary',
  repeat: ScheduledTaskRepeat.OneTime,
  time: '09:00',
  timezone: 'Europe/Berlin',
  modelId: 'gpt-4o',
  prompt: 'Summarize my inbox',
};

const cronDto = (
  fields: Record<string, string | null>,
  extra: Partial<ScheduledTaskDto> = {},
): ScheduledTaskDto =>
  ({
    ...baseDto,
    trigger: { cron: { fields: fields as Record<string, string> } },
    ...extra,
  }) as ScheduledTaskDto;

const mapValues = (dto: ScheduledTaskDto): ScheduledTaskCreateFormValues => {
  const result = mapScheduledTaskDtoToFormValues(dto);
  if (!result.ok) throw new Error(`mapping failed: ${result.reason}`);
  return result.values;
};

describe('scheduled-task-trigger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('mapFormValuesToCreateBody', () => {
    it('maps a one-time repeat to a zone-local trigger.date with the zone', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        repeat: ScheduledTaskRepeat.OneTime,
        runAt: '2026-07-24T09:00',
      });

      expect(body.trigger.date).toBe('2026-07-24T09:00:00');
      expect(body.trigger.cron).toBeUndefined();
      expect(body.timezone).toBe('Europe/Berlin');
    });

    it('keeps seconds already present in the run-at value', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        runAt: '2026-07-24T09:00:30',
      });

      expect(body.trigger.date).toBe('2026-07-24T09:00:30');
    });

    it('maps an hourly repeat to a wildcard hour with the entered minute', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        repeat: ScheduledTaskRepeat.Hourly,
        minute: '15',
        timezone: 'Asia/Kolkata',
      });

      expect(body.trigger.date).toBeUndefined();
      expect(body.trigger.cron?.fields).toEqual({ hour: '*', minute: '15' });
      expect(body.timezone).toBe('Asia/Kolkata');
    });

    it('maps a daily repeat to unshifted cron fields', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        repeat: ScheduledTaskRepeat.Daily,
        time: '09:00',
      });

      expect(body.trigger.cron?.fields).toEqual({ hour: '9', minute: '0' });
      expect(body.timezone).toBe('Europe/Berlin');
    });

    it('does not shift a weekly day when the local time is near midnight', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        repeat: ScheduledTaskRepeat.Weekly,
        dayOfWeek: '0',
        time: '23:30',
        timezone: 'Asia/Tokyo',
      });

      expect(body.trigger.cron?.fields).toEqual({
        hour: '23',
        minute: '30',
        day_of_week: '0',
      });
    });

    it('sends the 31st as 31 and the 1st as 1', () => {
      const monthly = (dayOfMonth: string) =>
        mapFormValuesToCreateBody({
          ...baseValues,
          repeat: ScheduledTaskRepeat.Monthly,
          dayOfMonth,
          time: '00:30',
        }).trigger.cron?.fields;

      expect(monthly('31')).toEqual({ hour: '0', minute: '30', day: '31' });
      expect(monthly('1')).toEqual({ hour: '0', minute: '30', day: '1' });
    });

    it('maps a custom repeat to a sorted weekday list with no week or day key', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        repeat: ScheduledTaskRepeat.Custom,
        daysOfWeek: ['4', '0', '2'],
        time: '09:00',
      });

      expect(body.trigger.cron?.fields).toEqual({
        day_of_week: '0,2,4',
        hour: '9',
        minute: '0',
      });
    });

    it('gives the same body whatever zone the process runs in', () => {
      const values: ScheduledTaskCreateFormValues = {
        ...baseValues,
        repeat: ScheduledTaskRepeat.Weekly,
        dayOfWeek: '2',
        time: '00:30',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      };

      vi.stubEnv('TZ', 'UTC');
      const inUtc = mapFormValuesToCreateBody(values);
      vi.stubEnv('TZ', 'Pacific/Auckland');
      const inAuckland = mapFormValuesToCreateBody(values);

      expect(inAuckland).toEqual(inUtc);
    });

    it('trims text fields and de-duplicates skills', () => {
      const body = mapFormValuesToCreateBody({
        ...baseValues,
        displayName: '  Daily  ',
        description: '  Summary  ',
        prompt: '  Do it  ',
        skillUrls: ['skills/public/a', 'skills/public/a'],
        runAt: '2026-07-24T09:00',
      });

      expect(body).toMatchObject({
        displayName: 'Daily',
        description: 'Summary',
        prompt: 'Do it',
        skillUrls: ['skills/public/a'],
      });
    });

    describe('activity window', () => {
      const recurring = (
        repeat: ScheduledTaskRepeat,
        extra: Partial<ScheduledTaskCreateFormValues> = {},
      ) =>
        mapFormValuesToCreateBody({
          ...baseValues,
          repeat,
          dayOfWeek: '0',
          dayOfMonth: '5',
          daysOfWeek: ['0', '2'],
          minute: '0',
          ...extra,
        });

      it('sends no boundary keys when no dates are set', () => {
        const cron = recurring(ScheduledTaskRepeat.Daily).trigger.cron;

        expect(cron).not.toHaveProperty('startDate');
        expect(cron).not.toHaveProperty('endDate');
      });

      it.each([
        ScheduledTaskRepeat.Daily,
        ScheduledTaskRepeat.Weekly,
        ScheduledTaskRepeat.Monthly,
        ScheduledTaskRepeat.Custom,
        ScheduledTaskRepeat.Hourly,
      ])('sends zone-local day boundaries for %s', (repeat) => {
        const cron = recurring(repeat, {
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        }).trigger.cron;

        expect(cron?.startDate).toBe('2026-08-01T00:00:00.000');
        expect(cron?.endDate).toBe('2026-08-31T23:59:59.999');
      });

      it('never sends a window for a one-time repeat', () => {
        const body = mapFormValuesToCreateBody({
          ...baseValues,
          repeat: ScheduledTaskRepeat.OneTime,
          runAt: '2026-07-24T09:00',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        });

        expect(body.trigger).toEqual({ date: '2026-07-24T09:00:00' });
      });
    });
  });

  describe('mapFormValuesToUpdateBody', () => {
    it('always sends the zone and an explicit skill list', () => {
      const body = mapFormValuesToUpdateBody({
        ...baseValues,
        runAt: '2026-07-24T09:00',
        timezone: 'America/Sao_Paulo',
      });

      expect(body.timezone).toBe('America/Sao_Paulo');
      expect(body.skillUrls).toEqual([]);
    });
  });

  describe('mapScheduledTaskDtoToFormValues', () => {
    it('shows a one-time instant in the task zone', () => {
      const values = mapValues({
        ...baseDto,
        trigger: { date: '2026-07-24T07:00:00.000Z' },
      });

      expect(values).toMatchObject({
        repeat: ScheduledTaskRepeat.OneTime,
        runAt: '2026-07-24T09:00',
        timezone: 'Europe/Berlin',
      });
    });

    it('uses an offset-less one-time date as stored in any browser zone', () => {
      vi.stubEnv('TZ', 'America/Los_Angeles');

      const values = mapValues({
        ...baseDto,
        timezone: 'Asia/Tokyo',
        trigger: { date: '2026-07-24T09:00:00' },
      });

      expect(values.runAt).toBe('2026-07-24T09:00');
    });

    it('opens a task saved without a zone as UTC with its stored time', () => {
      const dto = cronDto({ hour: '7', minute: '0' });
      delete (dto as Partial<ScheduledTaskDto>).timezone;

      expect(mapValues(dto)).toMatchObject({
        repeat: ScheduledTaskRepeat.Daily,
        time: '07:00',
        timezone: 'UTC',
      });
    });

    it('reads a daily task without an offset shift', () => {
      vi.stubEnv('TZ', 'Europe/Berlin');

      expect(
        mapValues(cronDto({ hour: '7', minute: '0' }, { timezone: 'UTC' })),
      ).toMatchObject({ time: '07:00', timezone: 'UTC' });
    });

    it('keeps the wall time of a daily task across the DST change', () => {
      const dto = cronDto({ hour: '9', minute: '0' });

      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
        const inSummer = mapValues(dto).time;
        vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
        const inWinter = mapValues(dto).time;

        expect([inSummer, inWinter]).toEqual(['09:00', '09:00']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('reads an hourly task', () => {
      expect(mapValues(cronDto({ hour: '*', minute: '15' }))).toMatchObject({
        repeat: ScheduledTaskRepeat.Hourly,
        minute: '15',
      });
    });

    it('reads a weekly task and keeps its weekday', () => {
      expect(
        mapValues(
          cronDto(
            { hour: '23', minute: '30', day_of_week: '0' },
            { timezone: 'Asia/Tokyo' },
          ),
        ),
      ).toMatchObject({
        repeat: ScheduledTaskRepeat.Weekly,
        dayOfWeek: '0',
        time: '23:30',
      });
    });

    it('reads a monthly task and keeps its day', () => {
      expect(
        mapValues(cronDto({ hour: '9', minute: '0', day: '31' })),
      ).toMatchObject({
        repeat: ScheduledTaskRepeat.Monthly,
        dayOfMonth: '31',
      });
    });

    it('reads a custom task and round-trips it', () => {
      const dto = cronDto({ day_of_week: '0,2,4', hour: '9', minute: '0' });
      const values = mapValues(dto);

      expect(values).toMatchObject({
        repeat: ScheduledTaskRepeat.Custom,
        daysOfWeek: ['0', '2', '4'],
        time: '09:00',
      });
      expect(mapFormValuesToCreateBody(values).trigger.cron?.fields).toEqual({
        day_of_week: '0,2,4',
        hour: '9',
        minute: '0',
      });
    });

    it('hydrates older UTC-instant boundaries in the task zone', () => {
      const values = mapValues({
        ...cronDto({ hour: '9', minute: '0' }),
        trigger: {
          cron: {
            fields: { hour: '9', minute: '0' },
            startDate: '2026-07-31T22:00:00.000Z',
            endDate: '2026-08-31T21:59:59.999Z',
          },
        },
      });

      expect(values).toMatchObject({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
    });

    it('hydrates offset-less boundaries as their date part', () => {
      const values = mapValues({
        ...baseDto,
        trigger: {
          cron: {
            fields: { hour: '*', minute: '0' },
            startDate: '2026-08-01T00:00:00.000',
            endDate: '2026-08-31T23:59:59.999',
          },
        },
      });

      expect(values).toMatchObject({
        repeat: ScheduledTaskRepeat.Hourly,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
    });

    it('hydrates the window of a custom task', () => {
      const values = mapValues({
        ...baseDto,
        trigger: {
          cron: {
            fields: { day_of_week: '0,2', hour: '9', minute: '0' },
            startDate: '2026-08-01T00:00:00.000',
            endDate: '2026-08-31T23:59:59.999',
          },
        },
      });

      expect(values).toMatchObject({
        repeat: ScheduledTaskRepeat.Custom,
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });
    });

    it('treats null-valued cron fields as absent', () => {
      expect(
        mapValues(
          cronDto({
            hour: '9',
            minute: '0',
            day: null,
            week: null,
            year: null,
            month: null,
            second: null,
            day_of_week: null,
          }),
        ).repeat,
      ).toBe(ScheduledTaskRepeat.Daily);
    });

    it('still reads a weekly task whose week field is null as Weekly', () => {
      expect(
        mapValues(
          cronDto({ hour: '7', minute: '0', day_of_week: '0', week: null }),
        ).repeat,
      ).toBe(ScheduledTaskRepeat.Weekly);
    });

    it('maps a skill-only task without catalog metadata', () => {
      const result = mapScheduledTaskDtoToFormValues({
        ...cronDto({ hour: '9', minute: '0' }),
        prompt: '',
        skillUrls: ['skills/public/a'],
      });

      expect(result.ok).toBe(true);
    });

    it.each(['*/1', '*/2', '2-40', '1,3', '*/12'])(
      'fails closed on week expression %s',
      (week) => {
        expect(
          mapScheduledTaskDtoToFormValues(
            cronDto({ day_of_week: '0,2', hour: '9', minute: '0', week }),
          ),
        ).toEqual({
          ok: false,
          reason: UnsupportedTriggerReason.UnsupportedCronShape,
        });
      },
    );

    it.each<Record<string, string>>([
      { hour: '9', minute: '0', month: '1' },
      { hour: '9', minute: '0', year: '2026' },
      { hour: '9', minute: '0', second: '5' },
      { day_of_week: '0,2', hour: '9', minute: '0', day: '5' },
      { hour: '9', minute: '0', day_of_week: '0-4' },
      { hour: '9', minute: '0', day_of_week: '*/2' },
      { hour: '*', minute: '0', day: '5' },
      { hour: '9', minute: '0', day: 'last' },
      { hour: '9', minute: '0', day: '32' },
      { hour: '9', minute: '0', day: '5', day_of_week: '1' },
      { hour: '*/2', minute: '0' },
    ])('fails closed on cron shape %j', (fields) => {
      expect(mapScheduledTaskDtoToFormValues(cronDto(fields))).toEqual({
        ok: false,
        reason: UnsupportedTriggerReason.UnsupportedCronShape,
      });
    });

    it('fails closed when both or neither trigger kind is set', () => {
      const expected = {
        ok: false,
        reason: UnsupportedTriggerReason.UnsupportedTriggerType,
      };

      expect(mapScheduledTaskDtoToFormValues(baseDto)).toEqual(expected);
      expect(
        mapScheduledTaskDtoToFormValues({
          ...baseDto,
          trigger: {
            date: '2026-07-24T09:00:00',
            cron: { fields: { hour: '9', minute: '0' } },
          },
        }),
      ).toEqual(expected);
    });

    it('fails closed on a zone the platform does not know', () => {
      expect(
        mapScheduledTaskDtoToFormValues(
          cronDto({ hour: '9', minute: '0' }, { timezone: 'Mars/Olympus' }),
        ),
      ).toEqual({
        ok: false,
        reason: UnsupportedTriggerReason.UnsupportedTriggerType,
      });
    });

    it.each([
      { model: '' },
      { model: undefined },
      { prompt: undefined },
      { prompt: '   ', skillUrls: [] },
    ])('fails closed on missing required fields %j', (override) => {
      expect(
        mapScheduledTaskDtoToFormValues({
          ...cronDto({ hour: '9', minute: '0' }),
          ...override,
        } as ScheduledTaskDto),
      ).toEqual({
        ok: false,
        reason: UnsupportedTriggerReason.MissingRequiredFields,
      });
    });
  });
});
