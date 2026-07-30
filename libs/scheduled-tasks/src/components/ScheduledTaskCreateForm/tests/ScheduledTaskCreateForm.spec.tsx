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
  GhostIconButton: ({
    onClick,
    'aria-label': ariaLabel,
  }: {
    onClick: () => void;
    icon?: ReactNode;
    'aria-label'?: string;
  }) => <button onClick={onClick} aria-label={ariaLabel} />,
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
  stream: true,
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

    expect(screen.getByText('Run at')).toBeTruthy();
    expect(screen.queryByText('Time')).toBeNull();
  });

  it('renders day-of-week only when frequency is weekly', async () => {
    await renderForm({
      values: { ...baseValues, frequency: ScheduledTaskFrequency.Weekly },
    });

    expect(screen.getByText('Day of week')).toBeTruthy();
    expect(screen.queryByText('Day of month')).toBeNull();
  });
});
