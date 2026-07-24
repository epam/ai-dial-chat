import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskCreateFormProps,
  ScheduledTaskCreateFormValues,
} from '../../../models/scheduled-task-create-form-props';
import { ScheduledTaskCreateForm } from '../ScheduledTaskCreateForm';

vi.mock('@epam/ai-dial-kit', () => ({
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
  GhostButton: ({ label }: { label: string }) => <button>{label}</button>,
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
  }: {
    labelProps?: { label: ReactNode; required?: boolean };
    value: string;
    onChange: (value: string) => void;
    error?: string;
  }) => (
    <label>
      {labelProps?.label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialDropdown: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialSegmentedControl: ({
    options,
    value,
    onChange,
    ariaLabel,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <div role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  DialSwitch: ({
    label,
    isOn,
    onChange,
    switchId,
  }: {
    label: ReactNode;
    isOn: boolean;
    onChange: (value: boolean) => void;
    switchId: string;
  }) => (
    <label htmlFor={switchId}>
      {label}
      <input
        id={switchId}
        type="checkbox"
        checked={isOn}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconCheck: () => <svg />,
  IconChevronDown: () => <svg />,
}));

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: '',
  scheduleType: 'recurring',
  frequency: 'daily',
  time: '09:00',
  modelId: '',
  prompt: '',
  stream: true,
};

const renderForm = (overrides?: Partial<ScheduledTaskCreateFormProps>) =>
  render(
    <ScheduledTaskCreateForm
      labels={{
        pageTitle: 'New scheduled task',
        displayNameLabel: 'Name',
        displayNameRequired: 'Name is required',
        scheduleSectionLabel: 'Schedule',
        scheduleTypeOnceLabel: 'Once',
        scheduleTypeRecurringLabel: 'Recurring',
        scheduleTypeAriaLabel: 'Schedule type',
        runAtLabel: 'Run at',
        frequencyLabel: 'Frequency',
        frequencyOptions: [
          { key: 'daily', label: 'Daily' },
          { key: 'weekly', label: 'Weekly' },
          { key: 'monthly', label: 'Monthly' },
        ],
        timeLabel: 'Time',
        dayOfWeekLabel: 'Day of week',
        dayOfMonthLabel: 'Day of month',
        modelLabel: 'Model',
        modelPlaceholder: 'Select a model',
        promptLabel: 'Prompt',
        streamLabel: 'Stream',
        cancelButtonLabel: 'Cancel',
        createButtonLabel: 'Create',
      }}
      values={baseValues}
      errors={{}}
      modelOptions={[{ id: 'gpt-4o', label: 'GPT-4o' }]}
      onFieldChange={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      {...overrides}
    />,
  );

describe('ScheduledTaskCreateForm', () => {
  it('renders display name, prompt, and stream fields with labels', () => {
    renderForm();

    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Prompt')).toBeTruthy();
    expect(screen.getByText('Stream')).toBeTruthy();
  });

  it('does not render a description field', () => {
    renderForm();

    expect(screen.queryByText('Description')).toBeNull();
  });

  it('disables Create when displayName is empty', () => {
    renderForm({
      values: { ...baseValues, modelId: 'gpt-4o', prompt: 'Summarize' },
    });

    expect(
      (screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('disables Create when modelId is empty', () => {
    renderForm({ values: { ...baseValues, displayName: 'Daily summary' } });

    expect(
      (screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('enables Create when all required fields are filled', () => {
    renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
    });

    expect(
      (screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('disables Create while isSubmitting', () => {
    renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
      isSubmitting: true,
    });

    expect(
      (screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('calls onFieldChange when the prompt changes', async () => {
    const onFieldChange = vi.fn();
    renderForm({ onFieldChange });

    await userEvent.type(screen.getByLabelText('Prompt'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('prompt', 'x');
  });

  it('calls onCancel and onSubmit', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    renderForm({
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
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('renders run-at instead of frequency/time when scheduleType is once', () => {
    renderForm({ values: { ...baseValues, scheduleType: 'once' } });

    expect(screen.getByText('Run at')).toBeTruthy();
    expect(screen.queryByText('Time')).toBeNull();
  });

  it('renders day-of-week only when frequency is weekly', () => {
    renderForm({ values: { ...baseValues, frequency: 'weekly' } });

    expect(screen.getByText('Day of week')).toBeTruthy();
    expect(screen.queryByText('Day of month')).toBeNull();
  });
});
