import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskCreateFormProps,
  ScheduledTaskCreateFormValues,
} from '../../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../../types/scheduled-task-schedule';
import { ScheduledTaskCreateForm } from '../ScheduledTaskCreateForm';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  Input: ({
    labelProps,
    value,
    onChange,
    error,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value: string;
    onChange: (value: string) => void;
    error?: string;
  }) => (
    <label>
      {labelProps?.label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span>{error}</span>}
    </label>
  ),
  NumberInput: ({
    labelProps,
    value,
    onChange,
    error,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value: string | number;
    onChange: (value?: number) => void;
    error?: string;
  }) => (
    <label>
      {labelProps?.label}
      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
      {error && <span>{error}</span>}
    </label>
  ),
  Textarea: ({
    labelProps,
    value,
    onChange,
    error,
    maxLength,
    caption,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value: string;
    onChange: (value: string) => void;
    error?: string;
    maxLength?: number;
    caption?: string;
  }) => (
    <label>
      {labelProps?.label}
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span>{error}</span>}
      {caption && <span>{caption}</span>}
    </label>
  ),
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  GhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    icon?: ReactNode;
    'aria-label'?: string;
  }) => <button onClick={onClick} aria-label={ariaLabel} />,
  NeutralButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  PrimaryButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} aria-busy={disabled}>
      {label}
    </button>
  ),
  CalendarMode: {
    Date: 'date',
    DateTime: 'datetime',
    Time: 'time',
    Weekday: 'weekday',
  },
  Calendar: ({
    id,
    label,
    value,
    onChange,
    placeholder,
  }: {
    id?: string;
    label?: string;
    value?: Date | string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
  }) => (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        placeholder={placeholder}
        value={typeof value === 'string' ? value : (value?.toISOString() ?? '')}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  ),
  Select: ({
    labelProps,
    value,
    onChange,
    options,
    error,
    placeholder,
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value?: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    error?: ReactNode;
    placeholder?: string;
  }) => (
    <label>
      {labelProps?.label}
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span>{error}</span>}
    </label>
  ),
  Spinner: () => <div>Loading</div>,
  Label: ({
    id,
    label,
    required,
  }: {
    id?: string;
    label: ReactNode;
    required?: boolean;
  }) => (
    <span id={id}>
      {label}
      {required && ' *'}
    </span>
  ),
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        value,
        onChange,
      }: {
        value: string;
        onChange: (value: string) => void;
      }) => (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ),
    }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => <svg />,
}));

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  modelId: '',
  prompt: '',
};

const renderForm = async (
  overrides?: Partial<ScheduledTaskCreateFormProps>,
) => {
  const result = render(
    <ScheduledTaskCreateForm
      labels={{
        pageTitle: 'New task',
        backButtonLabel: 'Back',
        detailsSectionTitle: 'Details',
        detailsSectionSubtitle: 'Basic info about this scheduled task',
        configurationSectionTitle: 'Configuration',
        configurationSectionSubtitle: 'Write custom instructions',
        displayNameLabel: 'Name',
        displayNameRequired: 'Name is required',
        runAtLabel: 'Run at',
        repeatLabel: 'Repeat',
        repeatOptions: [
          { key: ScheduledTaskRepeat.OneTime, label: 'One-time' },
          { key: ScheduledTaskRepeat.Hourly, label: 'Hourly' },
          { key: ScheduledTaskRepeat.Daily, label: 'Daily' },
          { key: ScheduledTaskRepeat.Weekly, label: 'Weekly' },
          { key: ScheduledTaskRepeat.Monthly, label: 'Monthly' },
        ],
        timeLabel: 'Time',
        dayOfWeekLabel: 'Day of week',
        dayOfMonthLabel: 'Day of month',
        minuteLabel: 'Minute',
        startDateLabel: 'Start date',
        startDatePlaceholder: 'Pick start date',
        endDateLabel: 'End date',
        endDatePlaceholder: 'Pick end date',
        modelOrAgentLabel: 'Model or Agent',
        descriptionLabel: 'Description',
        instructionsLabel: 'Instructions',
        cancelButtonLabel: 'Cancel',
        createButtonLabel: 'Save',
      }}
      values={baseValues}
      errors={{}}
      modelSelector={<button type="button">Select Model or Agent</button>}
      modelLabelId="scheduled-task-model-label"
      onFieldChange={vi.fn()}
      onBack={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      {...overrides}
    />,
  );
  await screen.findAllByRole('textbox');
  return result;
};

describe('ScheduledTaskCreateForm', () => {
  it('renders the host-supplied modelSelector verbatim', async () => {
    await renderForm({
      modelSelector: <button type="button">Custom model trigger</button>,
    });

    expect(
      screen.getByRole('button', { name: 'Custom model trigger' }),
    ).toBeTruthy();
  });

  it('wraps modelSelector with the required Model or Agent label', async () => {
    await renderForm();

    expect(screen.getByText('Model or Agent *')).toBeTruthy();
  });

  it('renders errors.modelId below the modelSelector slot', async () => {
    await renderForm({ errors: { modelId: 'Model is required' } });

    expect(screen.getByText('Model is required')).toBeTruthy();
  });

  it('renders display name field with label', async () => {
    await renderForm();

    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('renders an optional description field', async () => {
    await renderForm();

    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('does not block Save when description is empty', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
    });

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('respects the 500-character limit on the description field', async () => {
    await renderForm();

    expect(
      (screen.getByLabelText('Description') as HTMLTextAreaElement).maxLength,
    ).toBe(500);
  });

  it('calls onFieldChange when the description changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });

    await userEvent.type(screen.getByLabelText('Description'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('description', 'x');
  });

  it('disables Save when displayName is empty', async () => {
    await renderForm({
      values: { ...baseValues, modelId: 'gpt-4o', prompt: 'Summarize' },
    });

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('disables Save when modelId is empty', async () => {
    await renderForm({
      values: { ...baseValues, displayName: 'Daily summary' },
    });

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('enables Save when all required fields are filled', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
    });

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('disables Save while isSubmitting', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
      isSubmitting: true,
    });

    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('renders Details and Configuration as two distinct regions', async () => {
    await renderForm();

    expect(screen.getByRole('group', { name: 'Details' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Configuration' })).toBeTruthy();
  });

  it('calls onFieldChange when the instructions editor changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });

    const configuration = screen.getByRole('group', {
      name: 'Configuration',
    });
    const editor = within(configuration).getByRole('textbox');
    await userEvent.type(editor, 'x');

    expect(onFieldChange).toHaveBeenCalledWith('prompt', 'x');
  });

  it('calls onBack without calling onSubmit', async () => {
    const onBack = vi.fn();
    const onSubmit = vi.fn();
    await renderForm({
      onBack,
      onSubmit,
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel and onSubmit', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    await renderForm({
      onCancel,
      onSubmit,
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not render a Schedule section heading', async () => {
    await renderForm();

    expect(screen.queryByText('Schedule')).toBeNull();
  });

  it('renders run-at instead of time/day fields when repeat is oneTime', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
    });

    expect(screen.getByText('Run at *')).toBeTruthy();
    expect(screen.queryByText('Time *')).toBeNull();
  });

  it('renders no time, day-of-week, or day-of-month fields when repeat is hourly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    expect(screen.queryByText('Time *')).toBeNull();
    expect(screen.queryByText('Day of week *')).toBeNull();
    expect(screen.queryByText('Day of month')).toBeNull();
    expect(screen.queryByText('Run at *')).toBeNull();
  });

  it('renders the Minute field only when repeat is hourly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    expect(screen.getByText('Minute')).toBeTruthy();
  });

  it('does not render the Minute field for non-hourly repeats', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Daily },
    });

    expect(screen.queryByText('Minute')).toBeNull();
  });

  it('calls onFieldChange when the Minute field changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    await userEvent.type(screen.getByLabelText('Minute'), '5');

    expect(onFieldChange).toHaveBeenCalledWith('minute', '5');
  });

  it('renders errors.minute inline', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
      errors: { minute: 'Enter a valid minute' },
    });

    expect(screen.getByText('Enter a valid minute')).toBeTruthy();
  });

  it('renders start-date/end-date pickers when repeat is hourly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    expect(screen.getByText('Start date')).toBeTruthy();
    expect(screen.getByText('End date')).toBeTruthy();
  });

  it('renders the Time field when repeat is daily, weekly, or monthly', async () => {
    for (const repeat of [
      ScheduledTaskRepeat.Daily,
      ScheduledTaskRepeat.Weekly,
      ScheduledTaskRepeat.Monthly,
    ]) {
      const { unmount } = await renderForm({
        values: { ...baseValues, repeat },
      });

      expect(screen.getByText('Time *')).toBeTruthy();
      unmount();
    }
  });

  it('renders day-of-week only when repeat is weekly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Weekly },
    });

    expect(screen.getByText('Day of week *')).toBeTruthy();
    expect(screen.queryByText('Day of month')).toBeNull();
  });

  it('calls onFieldChange when the recurring Time calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange, values: { ...baseValues, time: '' } });

    await userEvent.type(screen.getByLabelText('Time *'), '1');

    expect(onFieldChange).toHaveBeenCalledWith('time', '1');
  });

  it('calls onFieldChange when the once Run at calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
    });

    await userEvent.type(screen.getByLabelText('Run at *'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('runAt', '');
  });

  it('converts the selected weekday to values.dayOfWeek (APScheduler Monday=0) when the day-of-week calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Weekly },
    });

    await userEvent.type(screen.getByLabelText('Day of week *'), '1');

    expect(onFieldChange).toHaveBeenCalledWith('dayOfWeek', '0');
  });

  it('does not render start-date/end-date pickers when repeat is oneTime', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
    });

    expect(screen.queryByText('Start date')).toBeNull();
    expect(screen.queryByText('End date')).toBeNull();
  });

  it('renders start-date/end-date pickers without a required marker for recurring repeats', async () => {
    await renderForm();

    expect(screen.getByText('Start date')).toBeTruthy();
    expect(screen.getByText('End date')).toBeTruthy();
  });

  it('renders the start/end date placeholders', async () => {
    await renderForm();

    expect(screen.getByPlaceholderText('Pick start date')).toBeTruthy();
    expect(screen.getByPlaceholderText('Pick end date')).toBeTruthy();
  });

  it('calls onFieldChange via calendarValueToDateValue when the start-date calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });

    await userEvent.type(screen.getByLabelText('Start date'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('startDate', '');
  });

  it('calls onFieldChange via calendarValueToDateValue when the end-date calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });

    await userEvent.type(screen.getByLabelText('End date'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('endDate', '');
  });

  it('renders errors.startDate and errors.endDate inline', async () => {
    await renderForm({
      errors: { startDate: 'Invalid start date', endDate: 'End before start' },
    });

    expect(screen.getByText('Invalid start date')).toBeTruthy();
    expect(screen.getByText('End before start')).toBeTruthy();
  });
});
