import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ScheduledTaskCreateFormProps,
  ScheduledTaskCreateFormValues,
} from '../../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../../types/scheduled-task-schedule';
import { ScheduledTaskCreateForm } from '../ScheduledTaskCreateForm';

vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
  LazyMarkdownEditor: () =>
    Promise.resolve({ MarkdownEditor: () => <textarea aria-label="Editor" /> }),
}));

const initialValues: ScheduledTaskCreateFormValues = {
  displayName: 'Report',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  modelId: 'gpt',
  prompt: 'Do it',
};

const buildProps = (
  overrides?: Partial<ScheduledTaskCreateFormProps>,
): ScheduledTaskCreateFormProps => ({
  labels: {
    pageTitle: 'New task',
    backButtonLabel: 'Back',
    detailsSectionTitle: 'Details',
    detailsSectionSubtitle: 'Basic info',
    configurationSectionTitle: 'Configuration',
    configurationSectionSubtitle: 'Instructions',
    displayNameLabel: 'Name',
    displayNameRequired: 'Name is required',
    runAtLabel: 'Run at',
    timeLabel: 'Time',
    timeInvalidLabel: 'Enter a valid time',
    repeatLabel: 'Repeat',
    repeatOptions: [{ key: ScheduledTaskRepeat.Daily, label: 'Daily' }],
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
  },
  values: initialValues,
  initialValues,
  errors: {},
  modelSelector: <button type="button">Select Model or Agent</button>,
  modelLabelId: 'model-label',
  onFieldChange: vi.fn(),
  onBack: vi.fn(),
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

describe('ScheduledTaskCreateForm — unsaved changes', () => {
  it('leaves immediately when nothing changed', async () => {
    const props = buildProps();
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it('leaves immediately when initialValues is omitted', async () => {
    const props = buildProps({
      initialValues: undefined,
      values: { ...initialValues, displayName: 'Changed' },
    });
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);

    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('asks for confirmation on Cancel when values changed', async () => {
    const props = buildProps({
      values: { ...initialValues, displayName: 'Changed' },
    });
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);

    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
    expect(
      screen.getByText(
        'You have unsaved changes. Leaving now will discard them.',
      ),
    ).toBeTruthy();
  });

  it('keeps the form open when Keep editing is chosen', async () => {
    const props = buildProps({
      values: { ...initialValues, displayName: 'Changed' },
    });
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(props.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it('calls onCancel only after Discard changes is chosen', async () => {
    const props = buildProps({
      values: { ...initialValues, displayName: 'Changed' },
    });
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard changes' }),
    );

    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onBack).not.toHaveBeenCalled();
  });

  it('guards the Back control the same way and uses custom labels', async () => {
    const props = buildProps({
      values: { ...initialValues, displayName: 'Changed' },
      labels: { ...buildProps().labels, discardTitle: 'Verwerfen?' },
    });
    render(<ScheduledTaskCreateForm {...props} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]);

    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Verwerfen?')).toBeTruthy();
  });
});
