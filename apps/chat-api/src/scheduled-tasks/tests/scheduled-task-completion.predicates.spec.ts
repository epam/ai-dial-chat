import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ScheduleTriggerType,
  type ScheduledTaskDto,
} from '../dto/scheduled-task.dto';
import {
  isCompletionCandidate,
  isExpiredRecurring,
  isPastDate,
} from '../scheduled-task-completion.service';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const PAST = '2026-06-01T09:00:00.000Z';
const FUTURE = '2026-07-01T09:00:00.000Z';

const makeTask = (fields: Partial<ScheduledTaskDto>): ScheduledTaskDto =>
  ({ id: 'sched_1', ...fields }) as ScheduledTaskDto;

describe('scheduled task completion predicates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isPastDate', () => {
    it('treats a past or current moment as passed', () => {
      expect(isPastDate(PAST)).toBe(true);
      expect(isPastDate(NOW.toISOString())).toBe(true);
    });

    it('treats a future, absent or unparseable date as not passed', () => {
      expect(isPastDate(FUTURE)).toBe(false);
      expect(isPastDate(undefined)).toBe(false);
      expect(isPastDate('not a date')).toBe(false);
    });
  });

  describe('isCompletionCandidate', () => {
    it('accepts a one-time schedule with no next run', () => {
      expect(
        isCompletionCandidate(
          makeTask({
            triggerType: ScheduleTriggerType.Date,
            nextRunTime: null,
          }),
        ),
      ).toBe(true);
    });

    it('accepts a one-time schedule whose trigger date has passed even with a next run', () => {
      expect(
        isCompletionCandidate(
          makeTask({
            triggerType: ScheduleTriggerType.Date,
            nextRunTime: FUTURE,
            trigger: { date: PAST },
          }),
        ),
      ).toBe(true);
    });

    it('rejects a one-time schedule with a next run and a future or missing trigger date', () => {
      expect(
        isCompletionCandidate(
          makeTask({
            triggerType: ScheduleTriggerType.Date,
            nextRunTime: FUTURE,
            trigger: { date: FUTURE },
          }),
        ),
      ).toBe(false);
      expect(
        isCompletionCandidate(
          makeTask({
            triggerType: ScheduleTriggerType.Date,
            nextRunTime: FUTURE,
          }),
        ),
      ).toBe(false);
    });

    it('never treats a recurring schedule as a candidate', () => {
      expect(
        isCompletionCandidate(
          makeTask({
            triggerType: ScheduleTriggerType.Cron,
            nextRunTime: null,
          }),
        ),
      ).toBe(false);
    });
  });

  describe('isExpiredRecurring', () => {
    it('detects a recurring schedule whose window closed with no next run', () => {
      expect(
        isExpiredRecurring(
          makeTask({
            triggerType: ScheduleTriggerType.Cron,
            nextRunTime: null,
            trigger: { cron: { endDate: PAST } },
          } as Partial<ScheduledTaskDto>),
        ),
      ).toBe(true);
    });

    it('keeps a recurring schedule with an open, unbounded or upcoming window non-terminal', () => {
      expect(
        isExpiredRecurring(
          makeTask({
            triggerType: ScheduleTriggerType.Cron,
            nextRunTime: null,
            trigger: { cron: { endDate: FUTURE } },
          } as Partial<ScheduledTaskDto>),
        ),
      ).toBe(false);
      expect(
        isExpiredRecurring(
          makeTask({
            triggerType: ScheduleTriggerType.Cron,
            nextRunTime: null,
          }),
        ),
      ).toBe(false);
      expect(
        isExpiredRecurring(
          makeTask({
            triggerType: ScheduleTriggerType.Cron,
            nextRunTime: FUTURE,
            trigger: { cron: { endDate: PAST } },
          } as Partial<ScheduledTaskDto>),
        ),
      ).toBe(false);
    });

    it('never treats a one-time schedule as expired recurring', () => {
      expect(
        isExpiredRecurring(
          makeTask({
            triggerType: ScheduleTriggerType.Date,
            nextRunTime: null,
            trigger: { date: PAST },
          }),
        ),
      ).toBe(false);
    });
  });
});
