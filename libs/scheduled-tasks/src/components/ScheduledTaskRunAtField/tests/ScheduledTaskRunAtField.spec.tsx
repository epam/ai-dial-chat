import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledTaskRunAtField } from '../ScheduledTaskRunAtField';

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
  /* Mirrors the real Calendar's surface: the label-wrapped input, the
     invalid flag, the disabled flag, and the minimum selectable date
     forwarded from the field. */
  Calendar: ({
    id,
    labelProps,
    value,
    onChange,
    placeholder,
    minDate,
    invalid,
    disabled,
  }: {
    id?: string;
    labelProps?: { label: React.ReactNode; required?: boolean };
    value?: Date | string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    minDate?: Date;
    invalid?: boolean;
    disabled?: boolean;
  }) => (
    <>
      <label htmlFor={id}>
        {labelProps?.label}
        {labelProps?.required && ' *'}
        <input
          id={id}
          placeholder={placeholder}
          value={
            typeof value === 'string' ? value : (value?.toISOString() ?? '')
          }
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      </label>
      {minDate && <span>hasMinDate</span>}
      {invalid && <span>isInvalid</span>}
      {disabled && <span>isDisabled</span>}
    </>
  ),
}));

const renderField = (
  props?: Partial<React.ComponentProps<typeof ScheduledTaskRunAtField>>,
) =>
  render(
    <ScheduledTaskRunAtField
      label="Date and time"
      placeholder="Pick date and time"
      value=""
      onChange={vi.fn()}
      {...props}
    />,
  );

describe('ScheduledTaskRunAtField', () => {
  it('renders the required label above the picker', () => {
    renderField();

    expect(screen.getByLabelText('Date and time *')).toBeTruthy();
  });

  it('renders the placeholder in the picker when unset', () => {
    renderField();

    expect(screen.getByPlaceholderText('Pick date and time')).toBeTruthy();
  });

  it('disables the picker', () => {
    renderField({ disabled: true });

    expect(screen.getByText('isDisabled')).toBeTruthy();
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
    fireEvent.change(screen.getByLabelText('Date and time *'), {
      target: { value: '2026-06-15T09:30' },
    });

    expect(onChange).toHaveBeenCalledWith('2026-06-15T09:30');
  });

  it('reports an empty value when the draft cannot be parsed', async () => {
    const onChange = vi.fn();
    renderField({ onChange });

    fireEvent.change(screen.getByLabelText('Date and time *'), {
      target: { value: 'x' },
    });

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the submit-time error under the picker, associated with it and announced', () => {
    renderField({ error: 'Pick a date in the future' });

    const control = screen.getByLabelText('Date and time *');
    const errorId = control.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(
      'Pick a date in the future',
    );
    expect(screen.getByText('Pick a date in the future').id).toBe(errorId);
    expect(screen.getByText('isInvalid')).toBeTruthy();
  });

  it('mounts the alert region empty before the error, then fills the same region', () => {
    const { rerender } = renderField();
    const region = screen.getByRole('alert');
    expect(region.textContent).toBe('');

    rerender(
      <ScheduledTaskRunAtField
        label="Date and time"
        placeholder="Pick date and time"
        value=""
        onChange={vi.fn()}
        error="Pick a date in the future"
      />,
    );

    expect(screen.getByRole('alert')).toBe(region);
    expect(region.textContent).toBe('Pick a date in the future');
  });

  it('renders no error and no invalid flag without an error', () => {
    renderField();

    expect(screen.queryByText('isInvalid')).toBeNull();
  });
});
