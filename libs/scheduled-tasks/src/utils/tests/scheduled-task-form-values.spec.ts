import { describe, expect, it } from 'vitest';
import type { ScheduledTaskCreateFormValues } from '../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../types/scheduled-task-schedule';
import { hasScheduledTaskFormChanges } from '../scheduled-task-form-values';

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  modelId: '',
  prompt: '',
};

describe('hasScheduledTaskFormChanges', () => {
  it('returns false for identical values', () => {
    expect(hasScheduledTaskFormChanges({ ...baseValues }, baseValues)).toBe(
      false,
    );
  });

  it('returns true when a field differs', () => {
    expect(
      hasScheduledTaskFormChanges(
        { ...baseValues, displayName: 'Report' },
        baseValues,
      ),
    ).toBe(true);
  });

  it('treats empty strings, missing fields and empty arrays as equal', () => {
    expect(
      hasScheduledTaskFormChanges(
        { ...baseValues, description: '', skillUrls: [] },
        baseValues,
      ),
    ).toBe(false);
  });

  it('ignores surrounding whitespace', () => {
    expect(
      hasScheduledTaskFormChanges(
        { ...baseValues, displayName: '  ' },
        baseValues,
      ),
    ).toBe(false);
  });

  it('detects a changed skill selection', () => {
    expect(
      hasScheduledTaskFormChanges(
        { ...baseValues, skillUrls: ['skills/a'] },
        { ...baseValues, skillUrls: ['skills/b'] },
      ),
    ).toBe(true);
  });
});
