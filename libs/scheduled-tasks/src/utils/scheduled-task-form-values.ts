import type { ScheduledTaskCreateFormValues } from '../models/scheduled-task-create-form-props';

const normalizeFormValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.length ? JSON.stringify(value) : '';
  return JSON.stringify(value);
};

/** Returns `true` when any field of `values` differs from `initialValues`; empty strings, `undefined` and empty arrays count as equal. */
export const hasScheduledTaskFormChanges = (
  values: ScheduledTaskCreateFormValues,
  initialValues: ScheduledTaskCreateFormValues,
): boolean => {
  const keys = new Set([
    ...Object.keys(values),
    ...Object.keys(initialValues),
  ]) as Set<keyof ScheduledTaskCreateFormValues>;

  for (const key of keys) {
    if (
      normalizeFormValue(values[key]) !== normalizeFormValue(initialValues[key])
    ) {
      return true;
    }
  }
  return false;
};
