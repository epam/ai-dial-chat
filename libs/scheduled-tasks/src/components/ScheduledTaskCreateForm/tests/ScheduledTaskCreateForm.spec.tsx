import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskCreateFormProps,
  ScheduledTaskCreateFormValues,
} from '../../../models/scheduled-task-create-form-props';
import {
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '../../../types/scheduled-task-schedule';
import { ScheduledTaskCreateForm } from '../ScheduledTaskCreateForm';

vi.mock('@epam/ai-dial-kit', () => ({
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
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
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
  DialSelectField: ({
    label,
    value,
    onChange,
    options,
    error,
    placeholder,
  }: {
    label?: ReactNode;
    value?: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    error?: ReactNode;
    placeholder?: string;
  }) => (
    <label>
      {label}
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
  DialSpinner: () => <div>Loading</div>,
  LazyDialMarkdownEditor: () =>
    Promise.resolve({
      DialMarkdownEditor: ({
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
  scheduleType: ScheduledTaskScheduleType.Recurring,
  frequency: ScheduledTaskFrequency.Daily,
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
        scheduleSectionLabel: 'Schedule',
        scheduleTypeOnceLabel: 'Once',
        scheduleTypeRecurringLabel: 'Recurring',
        scheduleTypeAriaLabel: 'Schedule type',
        runAtLabel: 'Run at',
        frequencyLabel: 'Frequency',
        frequencyOptions: [
          { key: ScheduledTaskFrequency.Daily, label: 'Daily' },
          { key: ScheduledTaskFrequency.Weekly, label: 'Weekly' },
          { key: ScheduledTaskFrequency.Monthly, label: 'Monthly' },
        ],
        timeLabel: 'Time',
        dayOfWeekLabel: 'Day of week',
        dayOfMonthLabel: 'Day of month',
        startDateLabel: 'Start date',
        startDatePlaceholder: 'Pick start date',
        endDateLabel: 'End date',
        endDatePlaceholder: 'Pick end date',
        modelOrAgentLabel: 'Model or Agent',
        modelPlaceholder: 'Select a model',
        descriptionLabel: 'Description',
        instructionsLabel: 'Instructions',
        cancelButtonLabel: 'Cancel',
        createButtonLabel: 'Save',
      }}
      values={baseValues}
      errors={{}}
      modelOptions={[{ id: 'gpt-4o', label: 'GPT-4o' }]}
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

  it('renders run-at instead of frequency/time when scheduleType is once', async () => {
    await renderForm({
      values: { ...baseValues, scheduleType: ScheduledTaskScheduleType.Once },
    });

    expect(screen.getByText('Run at *')).toBeTruthy();
    expect(screen.queryByText('Time *')).toBeNull();
  });

  it('renders day-of-week only when frequency is weekly', async () => {
    await renderForm({
      values: { ...baseValues, frequency: ScheduledTaskFrequency.Weekly },
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
      values: { ...baseValues, scheduleType: ScheduledTaskScheduleType.Once },
    });

    await userEvent.type(screen.getByLabelText('Run at *'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('runAt', '');
  });

  it('converts the selected weekday to values.dayOfWeek (APScheduler Monday=0) when the day-of-week calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, frequency: ScheduledTaskFrequency.Weekly },
    });

    await userEvent.type(screen.getByLabelText('Day of week *'), '1');

    expect(onFieldChange).toHaveBeenCalledWith('dayOfWeek', '0');
  });

  it('does not render start-date/end-date pickers when scheduleType is once', async () => {
    await renderForm({
      values: { ...baseValues, scheduleType: ScheduledTaskScheduleType.Once },
    });

    expect(screen.queryByText('Start date')).toBeNull();
    expect(screen.queryByText('End date')).toBeNull();
  });

  it('renders start-date/end-date pickers without a required marker for recurring schedules', async () => {
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
