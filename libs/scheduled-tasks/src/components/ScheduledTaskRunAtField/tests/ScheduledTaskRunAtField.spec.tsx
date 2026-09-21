import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskRunAtField } from '../ScheduledTaskRunAtField';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  CalendarMode: {
    Date: 'date',
    DateTime: 'datetime',
    Time: 'time',
    Weekday: 'weekday',
  },
  /* Mirrors the real Calendar's surface: the label-wrapped input, the
     invalid flag, and the minimum selectable date forwarded from the field. */
  Calendar: ({
    id,
    labelProps,
    value,
    onChange,
    minDate,
    invalid,
  }: {
    id?: string;
    labelProps?: { label: React.ReactNode; required?: boolean };
    value?: Date | string | null;
    onChange: (value: string | null) => void;
    minDate?: Date;
    invalid?: boolean;
  }) => (
    <>
      <label htmlFor={id}>
        {labelProps?.label}
        {labelProps?.required && ' *'}
        <input
          id={id}
          value={
            typeof value === 'string' ? value : (value?.toISOString() ?? '')
          }
          onChange={(e) => onChange(e.target.value || null)}
        />
      </label>
      {minDate && <span>hasMinDate</span>}
      {invalid && <span>isInvalid</span>}
    </>
  ),
}));

const renderField = (
  props?: Partial<React.ComponentProps<typeof ScheduledTaskRunAtField>>,
) =>
  render(
    <ScheduledTaskRunAtField
      label="Run at"
      value=""
      onChange={vi.fn()}
      {...props}
    />,
  );

describe('ScheduledTaskRunAtField', () => {
  it('renders the required label above the picker', () => {
    renderField();

    expect(screen.getByLabelText('Run at *')).toBeTruthy();
  });

  it('passes a minimum selectable date to the picker', () => {
    renderField();

    expect(screen.getByText('hasMinDate')).toBeTruthy();
  });

  it('reports a picked moment as a datetime-local value', async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    /* A local (no timezone suffix) string parses identically in any runner
       timezone, so the round-tripped value is stable. fireEvent.change sets
       the whole draft at once — typing keystroke-by-keystroke would be
       reverted by the controlled value between keys. */
    fireEvent.change(screen.getByLabelText('Run at *'), {
      target: { value: '2026-06-15T09:30' },
    });

    expect(onChange).toHaveBeenCalledWith('2026-06-15T09:30');
  });

  it('reports an empty value when the draft cannot be parsed', async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    fireEvent.change(screen.getByLabelText('Run at *'), {
      target: { value: 'x' },
    });

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the submit-time error under the picker and marks it invalid', () => {
    renderField({ error: 'Pick a date in the future' });

    expect(screen.getByText('Pick a date in the future')).toBeTruthy();
    expect(screen.getByText('isInvalid')).toBeTruthy();
  });

  it('renders no error and no invalid flag without an error', () => {
    renderField();

    expect(screen.queryByText('isInvalid')).toBeNull();
  });
});
