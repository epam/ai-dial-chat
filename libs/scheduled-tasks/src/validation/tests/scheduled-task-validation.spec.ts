import { describe, expect, it } from 'vitest';
import {
  ScheduledTaskRepeat,
  type ScheduledTaskCreateFormValues,
} from '../../index';
import {
  ScheduledTaskValidationErrorCode,
  validateScheduledTaskFormValues,
  validateScheduledTaskTextField,
} from '../index';

const now = new Date('2026-09-22T10:00:00.000Z');
const values: ScheduledTaskCreateFormValues = {
  displayName: 'Daily review',
  modelId: 'model-1',
  prompt: 'Review the day',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
};

describe('validateScheduledTaskFormValues', () => {
  it.each([true, false, undefined])(
    'validates the complete content matrix with support %s',
    (isSkillsSupported) => {
      for (const skillUrls of [
        undefined,
        [],
        ['skills/public/report'],
        ['skills/public/report', 'skills/public/summary'],
      ]) {
        for (const prompt of ['', 'Instructions']) {
          const errors = validateScheduledTaskFormValues(
            { ...values, skillUrls, prompt },
            { now, isSkillsSupported },
          );
          expect(errors.skillUrls).toBe(
            skillUrls?.length && isSkillsSupported !== true
              ? ScheduledTaskValidationErrorCode.SkillUnsupported
              : undefined,
          );
          expect(errors.prompt).toBe(
            !prompt && !skillUrls?.length
              ? ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired
              : undefined,
          );
        }
      }
    },
  );
  it('reports required common fields as stable codes', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, displayName: ' ', modelId: '', prompt: ' ' },
        { now },
      ),
    ).toEqual({
      displayName: ScheduledTaskValidationErrorCode.DisplayNameRequired,
      modelId: ScheduledTaskValidationErrorCode.ModelRequired,
      prompt: ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired,
    });
  });

  it('reports over-limit text fields and a control character in the name', () => {
    expect(
      validateScheduledTaskFormValues(
        {
          ...values,
          displayName: 'a'.repeat(257),
          prompt: 'a'.repeat(50001),
          description: 'a'.repeat(501),
        },
        { now },
      ),
    ).toEqual({
      displayName: ScheduledTaskValidationErrorCode.DisplayNameTooLong,
      prompt: ScheduledTaskValidationErrorCode.PromptTooLong,
      description: ScheduledTaskValidationErrorCode.DescriptionTooLong,
    });
    expect(validateScheduledTaskTextField('displayName', 'Daily\treview')).toBe(
      ScheduledTaskValidationErrorCode.DisplayNameControlCharacters,
    );
    expect(
      validateScheduledTaskTextField('displayName', 'a'.repeat(256)),
    ).toBeUndefined();
  });

  it('rejects empty or out-of-range weekly and monthly fields', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Weekly, dayOfWeek: '' },
        { now },
      ).dayOfWeek,
    ).toBe(ScheduledTaskValidationErrorCode.DayOfWeekInvalid);
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Monthly, dayOfMonth: '32' },
        { now },
      ).dayOfMonth,
    ).toBe(ScheduledTaskValidationErrorCode.DayOfMonthInvalid);
  });

  it('uses the injected clock and validates only active fields', () => {
    expect(
      validateScheduledTaskFormValues(
        {
          ...values,
          repeat: ScheduledTaskRepeat.OneTime,
          runAt: '2026-09-22T10:00',
          time: 'bad',
          dayOfWeek: '9',
        },
        { now },
      ),
    ).toEqual({ runAt: ScheduledTaskValidationErrorCode.RunAtInvalid });
  });

  it('validates cadence boundaries and activity windows', () => {
    expect(
      validateScheduledTaskFormValues(
        { ...values, repeat: ScheduledTaskRepeat.Hourly, minute: '60' },
        { now },
      ).minute,
    ).toBe(ScheduledTaskValidationErrorCode.MinuteInvalid);
    expect(
      validateScheduledTaskFormValues(
        {
          ...values,
          time: '24:00',
          startDate: '2026-02-30',
          endDate: '2026-01-01',
        },
        { now },
      ),
    ).toMatchObject({
      time: ScheduledTaskValidationErrorCode.TimeInvalid,
      startDate: ScheduledTaskValidationErrorCode.StartDateInvalid,
    });
  });

  it('rejects activity-window boundaries earlier than the clock today', () => {
    /* Constructed from local components so the clock's local today is
       2026-09-22 in every runner timezone. */
    const localNow = new Date(2026, 8, 22, 10, 0);

    expect(
      validateScheduledTaskFormValues(
        { ...values, startDate: '2026-09-21' },
        { now: localNow },
      ),
    ).toEqual({ startDate: ScheduledTaskValidationErrorCode.StartDateInPast });
    expect(
      validateScheduledTaskFormValues(
        { ...values, endDate: '2026-09-21' },
        { now: localNow },
      ),
    ).toEqual({ endDate: ScheduledTaskValidationErrorCode.EndDateInPast });
  });

  it('accepts a window starting on the clock today', () => {
    const localNow = new Date(2026, 8, 22, 10, 0);

    expect(
      validateScheduledTaskFormValues(
        { ...values, startDate: '2026-09-22', endDate: '2026-09-23' },
        { now: localNow },
      ),
    ).toEqual({});
  });

  it('accepts a single-day window where endDate equals startDate', () => {
    const localNow = new Date(2026, 8, 22, 10, 0);

    expect(
      validateScheduledTaskFormValues(
        { ...values, startDate: '2026-09-22', endDate: '2026-09-22' },
        { now: localNow },
      ),
    ).toEqual({});
  });

  it('exempts an unchanged original boundary loaded from an older task', () => {
    const localNow = new Date(2026, 8, 22, 10, 0);

    expect(
      validateScheduledTaskFormValues(
        { ...values, startDate: '2026-09-21', endDate: '2026-09-25' },
        {
          now: localNow,
          originalStartDate: '2026-09-21',
          originalEndDate: '2026-09-25',
        },
      ),
    ).toEqual({});
  });

  it('still rejects a boundary changed to a different past date', () => {
    const localNow = new Date(2026, 8, 22, 10, 0);

    expect(
      validateScheduledTaskFormValues(
        { ...values, startDate: '2026-09-20' },
        { now: localNow, originalStartDate: '2026-09-21' },
      ),
    ).toEqual({ startDate: ScheduledTaskValidationErrorCode.StartDateInPast });
    expect(
      validateScheduledTaskFormValues(
        { ...values, endDate: '2026-09-20' },
        { now: localNow, originalEndDate: '2026-09-21' },
      ),
    ).toEqual({ endDate: ScheduledTaskValidationErrorCode.EndDateInPast });
  });
});
