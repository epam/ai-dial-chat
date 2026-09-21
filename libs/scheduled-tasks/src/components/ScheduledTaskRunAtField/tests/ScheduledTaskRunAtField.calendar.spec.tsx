import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskRunAtField } from '../ScheduledTaskRunAtField';

/*
 * Real-kit interaction spec: no @epam/ai-dial-ui-kit mock in this file, so
 * the actual Calendar renders — popover, month grid, and day buttons — and
 * the unselectable-past-moments behavior is exercised the way a user meets it. The sibling
 * ScheduledTaskRunAtField.spec.tsx covers the field's own contract through
 * a mock; the two files must stay separate because vi.mock is file-wide.
 */

/* Matches the kit Calendar's DEFAULT_CALENDAR_LOCALE ('en-GB'), which
   drives the day buttons' aria-labels. */
const dayAriaLabel = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const onChange = vi.fn();

describe('ScheduledTaskRunAtField — real Calendar', () => {
  afterEach(() => {
    onChange.mockClear();
  });

  it('disables past days and reports only selectable ones through onChange', async () => {
    render(
      <ScheduledTaskRunAtField label="Run at" value="" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Run at/ }));

    /* The initial month view always contains yesterday (previous-month
       tail) and tomorrow (next-month head) inside its six-week window. */
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDay = screen.getByRole('button', {
      name: dayAriaLabel(yesterday),
    }) as HTMLButtonElement;
    expect(pastDay.disabled).toBe(true);
    /* fireEvent, not userEvent: real users cannot click a disabled button,
       and userEvent refuses to — the no-op is proven at the event level. */
    fireEvent.click(pastDay);
    expect(onChange).not.toHaveBeenCalled();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDay = screen.getByRole('button', {
      name: dayAriaLabel(tomorrow),
    }) as HTMLButtonElement;
    expect(futureDay.disabled).toBe(false);
    await userEvent.click(futureDay);

    expect(onChange).toHaveBeenCalledOnce();
    /* A picked day reports back as a datetime-local string (local midnight
       when no time was set yet). */
    expect(onChange.mock.calls[0][0]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    );
  });

  it('marks the pre-picked day as selected and keeps its time when re-picked', async () => {
    /* A future day (anything before today is unselectable because of the
       today), built runtime-relative so the test holds on any run date;
       local and timezone-suffix-free, so it parses identically anywhere. */
    const pickedDate = new Date();
    pickedDate.setDate(pickedDate.getDate() + 1);
    const pad = (value: number) => String(value).padStart(2, '0');
    const picked = `${pickedDate.getFullYear()}-${pad(pickedDate.getMonth() + 1)}-${pad(pickedDate.getDate())}T09:30`;
    render(
      <ScheduledTaskRunAtField
        label="Run at"
        value={picked}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Run at/ }));

    /* The value's month opens as the initial view. */
    const selectedDay = screen.getByRole('button', {
      name: dayAriaLabel(pickedDate),
    }) as HTMLButtonElement;
    expect(selectedDay.getAttribute('aria-pressed')).toBe('true');
    expect(selectedDay.disabled).toBe(false);

    await userEvent.click(selectedDay);
    /* Re-picking the same day keeps its time-of-day (DateTime mode). */
    expect(onChange).toHaveBeenCalledWith(picked);
  });
});
