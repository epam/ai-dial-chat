import { CalendarMode } from '@epam/ai-dial-ui-kit';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskBoundaryField } from '../ScheduledTaskBoundaryField';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  ErrorText: ({
    text,
    ...rest
  }: { text?: string } & React.HTMLAttributes<HTMLSpanElement>) =>
    text ? <span {...rest}>{text}</span> : null,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  CalendarMode: {
    Date: 'date',
    DateTime: 'datetime',
    Time: 'time',
    Weekday: 'weekday',
  },
  /* Mirrors the real Calendar's surface: the label-wrapped input reporting a
     local Date (datetime-local strings parse as local wall-clock in any
     runner timezone), the invalid and disabled flags, and the minimum
     selectable date forwarded from the field. */
  Calendar: ({
    id,
    labelProps,
    value,
    onChange,
    placeholder,
    minDate,
    invalid,
    disabled,
    mode,
  }: {
    id?: string;
    labelProps?: { label: React.ReactNode };
    value?: Date | string | null;
    onChange: (value: Date | null) => void;
    placeholder?: string;
    minDate?: Date;
    invalid?: boolean;
    disabled?: boolean;
    mode?: string;
  }) => (
    <>
      <label htmlFor={id}>
        {labelProps?.label}
        <input
          id={id}
          placeholder={placeholder}
          value={
            typeof value === 'string' ? value : (value?.toISOString() ?? '')
          }
          onChange={(e) =>
            onChange(e.target.value ? new Date(e.target.value) : null)
          }
          disabled={disabled}
        />
      </label>
      {mode === 'datetime' && <span>isDateTimeMode</span>}
      {minDate && <span>hasMinDate</span>}
      {invalid && <span>isInvalid</span>}
      {disabled && <span>isDisabled</span>}
    </>
  ),
}));

const renderField = (
  props?: Partial<React.ComponentProps<typeof ScheduledTaskBoundaryField>>,
) =>
  render(
    <ScheduledTaskBoundaryField
      id="scheduled-task-start-date"
      mode={CalendarMode.Date}
      label="Start date"
      placeholder="Pick start date"
      value=""
      onChange={vi.fn()}
      minDate={new Date()}
      {...props}
    />,
  );

/* A local (no timezone suffix) datetime-local string parses identically in
   any runner timezone, so the typed draft converts to the same Date. */
const typeIntoPicker = (value: string) =>
  fireEvent.change(screen.getByLabelText('Start date'), {
    target: { value },
  });

describe('ScheduledTaskBoundaryField', () => {
  it('renders the label and placeholder on the picker', () => {
    renderField();

    expect(screen.getByLabelText('Start date')).toBeTruthy();
    expect(screen.getByPlaceholderText('Pick start date')).toBeTruthy();
  });

  it('passes a minimum selectable date to the picker', () => {
    renderField();

    expect(screen.getByText('hasMinDate')).toBeTruthy();
  });

  it('reports a whole-day boundary as a date-only value in Date mode', () => {
    const onChange = vi.fn();
    renderField({ onChange });

    typeIntoPicker('2026-06-15T09:30');

    expect(onChange).toHaveBeenCalledWith('2026-06-15');
  });

  it('reports an exact-moment boundary as a datetime-local value in DateTime mode', () => {
    const onChange = vi.fn();
    renderField({ mode: CalendarMode.DateTime, onChange });

    typeIntoPicker('2026-06-15T09:30');

    expect(onChange).toHaveBeenCalledWith('2026-06-15T09:30');
  });

  it('reports an empty value when the draft cannot be parsed', () => {
    const onChange = vi.fn();
    renderField({ onChange });

    typeIntoPicker('x');

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the submit-time error under the picker, associated with it and announced', () => {
    renderField({ error: 'Enter a valid start date' });

    const control = screen.getByLabelText('Start date');
    const errorId = control.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a valid start date',
    );
    expect(screen.getByRole('alert').id).toBe(errorId);
    expect(screen.getByText('isInvalid')).toBeTruthy();
  });

  it('renders no error and no invalid flag without an error', () => {
    renderField();

    expect(screen.queryByText('isInvalid')).toBeNull();
  });

  it('disables the picker', () => {
    renderField({ disabled: true });

    expect(screen.getByText('isDisabled')).toBeTruthy();
  });
});
