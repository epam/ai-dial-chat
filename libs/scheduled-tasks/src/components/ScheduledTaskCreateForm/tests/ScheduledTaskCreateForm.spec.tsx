import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, type FocusEventHandler } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ScheduledTaskCreateFormProps,
  ScheduledTaskCreateFormValues,
} from '../../../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../../../types/scheduled-task-schedule';
import { ScheduledTaskCreateForm } from '../ScheduledTaskCreateForm';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  ButtonVariant: { Primary: 'primary', Neutral: 'neutral' },
  ButtonAppearance: { Solid: 'solid' },
  ErrorText: ({ text }: { text?: string }) =>
    text ? <span role="alert">{text}</span> : null,
  CaptionText: ({ text }: { text?: string }) => (text ? <p>{text}</p> : null),
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
  /* Mirrors the real button: `aria-busy` and `iconBefore` are independent of
     `disabled`, which is what lets a test tell "submitting" from "not ready". */
  PrimaryButton: ({
    label,
    onClick,
    disabled,
    iconBefore,
    'aria-busy': ariaBusy,
  }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    iconBefore?: ReactNode;
    'aria-busy'?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled} aria-busy={ariaBusy}>
      {iconBefore}
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
    labelProps,
    value,
    onChange,
    onBlur,
    placeholder,
    disabled,
    showTimezone,
    minDate,
    mode,
  }: {
    id?: string;
    labelProps?: { label: ReactNode; required?: boolean };
    value?: Date | string | null;
    onChange: (value: string | null) => void;
    onBlur?: FocusEventHandler<HTMLInputElement>;
    placeholder?: string;
    disabled?: boolean;
    showTimezone?: boolean;
    minDate?: Date;
    mode?: string;
  }) => (
    /* The timezone hint renders outside the label, mirroring the kit's
       trailing-edge adornment, so it does not pollute the input's
       accessible name. */
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
          onBlur={onBlur}
          disabled={disabled}
        />
      </label>
      {mode === 'datetime' && <span>isDateTimeMode</span>}
      {showTimezone && <span>(GMT+00:00) (UTC) UTC</span>}
      {minDate && <span>hasMinDate</span>}
    </>
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
  Button: ({
    label,
    variant,
    className,
    disabled,
    onClick,
    ...rest
  }: {
    label?: ReactNode;
    variant?: string;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
  }) => (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {label}
    </button>
  ),
  Spinner: () => <div>Loading</div>,
  Label: ({
    id,
    htmlFor,
    label,
    required,
  }: {
    id?: string;
    htmlFor?: string;
    label: ReactNode;
    required?: boolean;
  }) => (
    <label id={id} htmlFor={htmlFor}>
      {label}
      {required && ' *'}
    </label>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit/editors', () => ({
  LazyMarkdownEditor: () =>
    Promise.resolve({
      MarkdownEditor: ({
        value,
        onChange,
        id,
      }: {
        value: string;
        onChange: (value: string) => void;
        id?: string;
      }) => (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowNarrowLeft: () => <svg />,
}));

const baseValues: ScheduledTaskCreateFormValues = {
  displayName: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  modelId: '',
  prompt: '',
};

/* Full default props, overridable per test — also used directly by tests
   that drive repeat switches through `rerender`. */
const buildFormProps = (
  overrides?: Partial<ScheduledTaskCreateFormProps>,
): ScheduledTaskCreateFormProps => ({
  labels: {
    pageTitle: 'New task',
    backButtonLabel: 'Back',
    detailsSectionTitle: 'Details',
    detailsSectionSubtitle: 'Basic info about this scheduled task',
    configurationSectionTitle: 'Configuration',
    displayNameLabel: 'Name',
    displayNameRequired: 'Name is required',
    runAtLabel: 'Date and time',
    runAtPlaceholder: 'Pick date and time',
    timeLabel: 'Time',
    timeInvalidLabel: 'Enter a valid time',
    repeatLabel: 'Repeat',
    repeatOptions: [
      { key: ScheduledTaskRepeat.OneTime, label: 'One-time' },
      { key: ScheduledTaskRepeat.Hourly, label: 'Hourly' },
      { key: ScheduledTaskRepeat.Daily, label: 'Daily' },
      { key: ScheduledTaskRepeat.Weekly, label: 'Weekly' },
      { key: ScheduledTaskRepeat.Monthly, label: 'Monthly' },
      { key: ScheduledTaskRepeat.Custom, label: 'Custom' },
    ],
    dayOfWeekLabel: 'Day',
    dayOfMonthLabel: 'Day of month',
    minuteLabel: 'Minute',
    everyLabel: 'Every',
    everyWeekOptions: [
      { value: '1', label: '1 week' },
      { value: '2', label: '2 weeks' },
      { value: '3', label: '3 weeks' },
    ],
    customDayOptions: [
      { value: '0', shortLabel: 'M', fullName: 'Monday' },
      { value: '1', shortLabel: 'T', fullName: 'Tuesday' },
      { value: '2', shortLabel: 'W', fullName: 'Wednesday' },
      { value: '3', shortLabel: 'T', fullName: 'Thursday' },
      { value: '4', shortLabel: 'F', fullName: 'Friday' },
      { value: '5', shortLabel: 'S', fullName: 'Saturday' },
      { value: '6', shortLabel: 'S', fullName: 'Sunday' },
    ],
    startDateLabel: 'Start date',
    startDateAndTimeLabel: 'Start date and time',
    startDatePlaceholder: 'Pick start date',
    endDateLabel: 'End date',
    endDateAndTimeLabel: 'End date and time',
    endDatePlaceholder: 'Pick end date',
    modelOrAgentLabel: 'Model or Agent',
    descriptionLabel: 'Description',
    instructionsLabel: 'Instructions',
    cancelButtonLabel: 'Cancel',
    createButtonLabel: 'Save',
  },
  values: baseValues,
  errors: {},
  modelSelector: <button type="button">Select Model or Agent</button>,
  modelLabelId: 'scheduled-task-model-label',
  onFieldChange: vi.fn(),
  onBack: vi.fn(),
  onCancel: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

const renderForm = async (
  overrides?: Partial<ScheduledTaskCreateFormProps>,
) => {
  const view = render(
    <ScheduledTaskCreateForm {...buildFormProps(overrides)} />,
  );
  await screen.findAllByRole('textbox');
  return view;
};

/* The action pair renders twice — in the header (desktop breakpoint) and in
   the mobile sticky footer — with identical props. jsdom ignores the CSS that
   hides one copy per breakpoint, so queries must address both. */
const getSaveButtons = () =>
  screen.getAllByRole('button', { name: 'Save' }) as HTMLButtonElement[];
const getCancelButtons = () =>
  screen.getAllByRole('button', { name: 'Cancel' });

describe('ScheduledTaskCreateForm', () => {
  it('renders a self-labelled skill slot and allows skill-only saves unless invalid, including hidden skills', () => {
    const props = buildFormProps({
      values: {
        ...baseValues,
        displayName: 'Task',
        modelId: 'model',
        skillUrls: ['skills/public/report'],
      },
      skillSelector: <button aria-label="Skill">Pick</button>,
    });
    props.labels.skillLabel = 'Skill';
    const { rerender } = render(<ScheduledTaskCreateForm {...props} />);
    expect(screen.getByRole('button', { name: 'Skill' })).toBeTruthy();
    expect(
      (screen.getAllByRole('button', { name: 'Save' })[0] as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    rerender(
      <ScheduledTaskCreateForm
        {...props}
        skillSelector={undefined}
        errors={{ skillUrls: 'Unsupported' }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Skill' })).toBeNull();
    expect(screen.getByText('Unsupported')).toBeTruthy();
    expect(
      (screen.getAllByRole('button', { name: 'Save' })[0] as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it('renders the action pair in both the header and the mobile sticky footer', async () => {
    await renderForm();

    /* One copy per breakpoint surface; CSS hides the other at any width. */
    expect(getSaveButtons()).toHaveLength(2);
    expect(getCancelButtons()).toHaveLength(2);
  });

  it('renders the host-supplied modelSelector verbatim', async () => {
    await renderForm({
      modelSelector: <button type="button">Custom model trigger</button>,
    });

    expect(
      screen.getByRole('button', { name: 'Custom model trigger' }),
    ).toBeTruthy();
  });

  it('renders the lib-owned time field with the required label and timezone hint', async () => {
    await renderForm();

    expect(screen.getByLabelText('Time *')).toBeTruthy();
    expect(screen.getByText('(GMT+00:00) (UTC) UTC')).toBeTruthy();
  });

  it('reports a complete time through onFieldChange', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });

    fireEvent.change(screen.getByLabelText('Time *'), {
      target: { value: '10:30' },
    });

    expect(onFieldChange).toHaveBeenCalledWith('time', '10:30');
  });

  it('shows the blur error under the time field for an incomplete draft', async () => {
    await renderForm();

    /* The real kit input keeps an internal draft that diverges from the
       controlled value (it only reports complete `HH:mm` through onChange).
       Set the draft directly — a fireEvent.change would be reverted by the
       controlled re-render before blur reads it. */
    const timeInput = screen.getByLabelText('Time *') as HTMLInputElement;
    timeInput.value = '9:5';
    fireEvent.blur(timeInput);

    expect(screen.getByText('Enter a valid time')).toBeTruthy();
  });

  it('clears the blur error once a complete value is entered', async () => {
    await renderForm();

    const timeInput = screen.getByLabelText('Time *') as HTMLInputElement;
    timeInput.value = '9:5';
    fireEvent.blur(timeInput);
    expect(screen.getByText('Enter a valid time')).toBeTruthy();

    fireEvent.change(timeInput, { target: { value: '09:30' } });

    expect(screen.queryByText('Enter a valid time')).toBeNull();
  });

  it('disables Save while the time draft is invalid', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize',
      },
    });
    expect(getSaveButtons().every((button) => !button.disabled)).toBe(true);

    const timeInput = screen.getByLabelText('Time *') as HTMLInputElement;
    timeInput.value = '9:5';
    fireEvent.blur(timeInput);
    expect(getSaveButtons().every((button) => button.disabled)).toBe(true);

    fireEvent.change(timeInput, { target: { value: '09:30' } });
    expect(getSaveButtons().every((button) => !button.disabled)).toBe(true);
  });

  it('re-reports a valid draft through onFieldChange on blur', async () => {
    const onFieldChange = vi.fn();
    await renderForm({ onFieldChange });
    onFieldChange.mockClear();

    const timeInput = screen.getByLabelText('Time *') as HTMLInputElement;
    timeInput.value = '09:30';
    fireEvent.blur(timeInput);

    /* The re-report is what lets a host clear its own errors.time on a
       blur that changed nothing. */
    expect(onFieldChange).toHaveBeenCalledWith('time', '09:30');
    expect(screen.queryByText('Enter a valid time')).toBeNull();

    /* Every blur reports the visible draft, complete or not — the host's
       error-clearing path runs either way. */
    onFieldChange.mockClear();
    timeInput.value = '9:5';
    fireEvent.blur(timeInput);
    expect(onFieldChange).toHaveBeenCalledWith('time', '9:5');
    expect(screen.getByText('Enter a valid time')).toBeTruthy();
  });

  it('clears a stale blur error when repeat hides and re-shows the time field', async () => {
    const validValues = {
      ...baseValues,
      displayName: 'Daily summary',
      modelId: 'gpt-4o',
      prompt: 'Summarize',
    };
    const view = await renderForm({ values: validValues });

    const timeInput = screen.getByLabelText('Time *') as HTMLInputElement;
    timeInput.value = '9:5';
    fireEvent.blur(timeInput);
    expect(getSaveButtons().every((button) => button.disabled)).toBe(true);

    /* A repeat switch hides the field (the host updates values); switching
       back re-shows it — the stale error must not survive the round trip. */
    view.rerender(
      <ScheduledTaskCreateForm
        {...buildFormProps({
          values: { ...validValues, repeat: ScheduledTaskRepeat.Hourly },
        })}
      />,
    );
    view.rerender(
      <ScheduledTaskCreateForm {...buildFormProps({ values: validValues })} />,
    );

    expect(screen.queryByText('Enter a valid time')).toBeNull();
    expect(getSaveButtons().every((button) => !button.disabled)).toBe(true);
  });

  describe('ScheduledTaskCreateForm — repeat-switch boundary handling', () => {
    const user = userEvent.setup();

    const selectRepeat = async (value: ScheduledTaskRepeat) => {
      await user.selectOptions(
        screen.getByLabelText('Repeat') as HTMLSelectElement,
        value,
      );
    };

    it('clears both boundaries when switching from Hourly to a day-based repeat', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
          repeat: ScheduledTaskRepeat.Hourly,
          minute: '30',
          startDate: '2026-09-22T18:00',
          endDate: '2026-09-23T18:45',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Daily);

      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Daily,
      );
      expect(onFieldChange).toHaveBeenCalledWith('startDate', '');
      expect(onFieldChange).toHaveBeenCalledWith('endDate', '');
    });

    it('clears both boundaries when switching to Hourly', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
          startDate: '2026-09-22',
          endDate: '2026-09-23',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Hourly);

      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Hourly,
      );
      expect(onFieldChange).toHaveBeenCalledWith('startDate', '');
      expect(onFieldChange).toHaveBeenCalledWith('endDate', '');
    });

    it('leaves boundaries untouched when switching between day-based repeats', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
          startDate: '2026-09-22',
          endDate: '2026-09-23',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Weekly);

      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Weekly,
      );
      expect(onFieldChange).not.toHaveBeenCalledWith(
        'startDate',
        expect.anything(),
      );
      expect(onFieldChange).not.toHaveBeenCalledWith(
        'endDate',
        expect.anything(),
      );
    });

    it('emits only the repeat change when no boundary is set', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Hourly);

      expect(onFieldChange).toHaveBeenCalledOnce();
      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Hourly,
      );
    });

    it('clears both boundaries when switching to Custom', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
          startDate: '2026-09-22',
          endDate: '2026-09-23',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Custom);

      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Custom,
      );
      expect(onFieldChange).toHaveBeenCalledWith('startDate', '');
      expect(onFieldChange).toHaveBeenCalledWith('endDate', '');
    });

    it('clears both boundaries when switching from Custom to a day-based repeat', async () => {
      const onFieldChange = vi.fn();
      await renderForm({
        onFieldChange,
        values: {
          ...baseValues,
          displayName: 'Task',
          modelId: 'gpt-4o',
          prompt: 'Summarize',
          repeat: ScheduledTaskRepeat.Custom,
          everyWeeks: '2',
          dayOfWeek: '0',
          startDate: '2026-09-22',
          endDate: '2026-09-23',
        },
      });
      onFieldChange.mockClear();

      await selectRepeat(ScheduledTaskRepeat.Daily);

      expect(onFieldChange).toHaveBeenCalledWith(
        'repeat',
        ScheduledTaskRepeat.Daily,
      );
      expect(onFieldChange).toHaveBeenCalledWith('startDate', '');
      expect(onFieldChange).toHaveBeenCalledWith('endDate', '');
    });
  });

  describe('ScheduledTaskCreateForm — custom repeat', () => {
    const user = userEvent.setup();

    const customValues: ScheduledTaskCreateFormValues = {
      ...baseValues,
      displayName: 'Task',
      modelId: 'gpt-4o',
      prompt: 'Summarize',
      repeat: ScheduledTaskRepeat.Custom,
      everyWeeks: '2',
      dayOfWeek: '0',
    };

    it('renders the Every dropdown, Time field, and a labeled day button row in that order', async () => {
      await renderForm({ values: customValues });

      expect(screen.getByLabelText('Every')).toBeTruthy();
      expect(screen.getByText('Day *')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Day *' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Monday' })).toBeTruthy();
      expect(screen.getByLabelText('Time *')).toBeTruthy();
      expect(screen.queryByLabelText('Start date')).toBeNull();
      expect(screen.queryByLabelText('End date')).toBeNull();

      /* The day row sits below the Time field. */
      const timeField = screen.getByLabelText('Time *');
      const dayRow = screen.getByRole('group', { name: 'Day *' });
      expect(timeField.compareDocumentPosition(dayRow)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('reports the selected week count through onFieldChange', async () => {
      const onFieldChange = vi.fn();
      await renderForm({ onFieldChange, values: customValues });

      await user.selectOptions(
        screen.getByLabelText('Every') as HTMLSelectElement,
        '3',
      );

      expect(onFieldChange).toHaveBeenCalledWith('everyWeeks', '3');
    });

    it('reports the selected day in APScheduler convention and ignores re-selecting it', async () => {
      const onFieldChange = vi.fn();
      await renderForm({ onFieldChange, values: customValues });

      const monday = screen.getByRole('button', { name: 'Monday' });
      expect(monday.getAttribute('aria-pressed')).toBe('true');
      /* 40x40px circular: the fixed width plus the round corners. */
      expect(monday.className).toContain('w-10');
      expect(monday.className).toContain('rounded-full');
      expect(
        screen
          .getByRole('button', { name: 'Wednesday' })
          .getAttribute('aria-pressed'),
      ).toBe('false');

      await user.click(screen.getByRole('button', { name: 'Wednesday' }));
      expect(onFieldChange).toHaveBeenCalledWith('dayOfWeek', '2');

      onFieldChange.mockClear();
      await user.click(screen.getByRole('button', { name: 'Monday' }));
      expect(onFieldChange).not.toHaveBeenCalledWith(
        'dayOfWeek',
        expect.anything(),
      );
    });

    it('disables Save until the custom day is selected', async () => {
      const values = { ...customValues, dayOfWeek: undefined };
      const view = await renderForm({ values });
      expect(getSaveButtons().every((button) => button.disabled)).toBe(true);

      /* A selected day re-enables Save (the host updates values.dayOfWeek). */
      view.rerender(
        <ScheduledTaskCreateForm
          {...buildFormProps({ values: { ...values, dayOfWeek: '0' } })}
        />,
      );
      expect(getSaveButtons().every((button) => !button.disabled)).toBe(true);
    });

    it('renders the day-of-week error below the day row', async () => {
      await renderForm({
        values: { ...customValues, dayOfWeek: undefined },
        errors: { dayOfWeek: 'Day of week is required' },
      });

      expect(screen.getByText('Day of week is required')).toBeTruthy();
    });
  });

  it('disables Save while the shown time field is empty', async () => {
    const validValues = {
      ...baseValues,
      time: '',
      displayName: 'Daily summary',
      modelId: 'gpt-4o',
      prompt: 'Summarize',
    };
    const view = await renderForm({ values: validValues });
    expect(getSaveButtons().every((button) => button.disabled)).toBe(true);

    /* A complete entry re-enables Save (the host updates values.time). */
    view.rerender(
      <ScheduledTaskCreateForm
        {...buildFormProps({ values: { ...validValues, time: '09:30' } })}
      />,
    );
    expect(getSaveButtons().every((button) => !button.disabled)).toBe(true);
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

    getSaveButtons().forEach((button) => expect(button.disabled).toBe(false));
  });

  it('respects the 500-character limit on the description field', async () => {
    await renderForm();

    expect(
      (screen.getByLabelText('Description') as HTMLTextAreaElement).maxLength,
    ).toBe(500);
  });

  it('shows the description counter even when the description is empty', async () => {
    await renderForm({ values: { ...baseValues, description: '' } });

    expect(screen.getByText('0/500')).toBeTruthy();
  });

  it('counts the description characters', async () => {
    await renderForm({ values: { ...baseValues, description: 'abc' } });

    expect(screen.getByText('3/500')).toBeTruthy();
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

    getSaveButtons().forEach((button) => expect(button.disabled).toBe(true));
  });

  it('disables Save when modelId is empty', async () => {
    await renderForm({
      values: { ...baseValues, displayName: 'Daily summary' },
    });

    getSaveButtons().forEach((button) => expect(button.disabled).toBe(true));
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

    getSaveButtons().forEach((button) => expect(button.disabled).toBe(false));
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

    getSaveButtons().forEach((button) => expect(button.disabled).toBe(true));
  });

  it('shows a busy affordance on Save while isSubmitting, not just a disabled button', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'Daily summary',
        modelId: 'gpt-4o',
        prompt: 'Summarize my inbox',
      },
      isSubmitting: true,
    });

    /* The name must not drift while submitting — the spinner is decorative. */
    getSaveButtons().forEach((button) =>
      expect(button.getAttribute('aria-busy')).toBe('true'),
    );
    expect(screen.getByRole('status').textContent).toBe('Saving');
  });

  it('leaves Save disabled but not busy when the form is merely incomplete', async () => {
    await renderForm({ values: baseValues, isSubmitting: false });

    getSaveButtons().forEach((button) => {
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('false');
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('names the Instructions editor through a real label association', async () => {
    await renderForm();

    expect(screen.getByRole('textbox', { name: /^Instructions/ })).toBeTruthy();
  });

  it('marks Instructions as required while no skill is selected', async () => {
    await renderForm();

    expect(screen.getByText('Instructions *')).toBeTruthy();
  });

  it('drops the required marker once a skill is selected', async () => {
    await renderForm({
      values: { ...baseValues, skillUrls: ['skills/a'] },
    });

    expect(screen.getByText('Instructions')).toBeTruthy();
    expect(screen.queryByText('Instructions *')).toBeNull();
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

    /* Click every copy — header and footer — so the test also proves both
       surfaces are wired to the same handlers. */
    for (const cancel of getCancelButtons()) {
      await userEvent.click(cancel);
    }
    for (const save of getSaveButtons()) {
      await userEvent.click(save);
    }

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('does not render a Schedule section heading', async () => {
    await renderForm();

    expect(screen.queryByText('Schedule')).toBeNull();
  });

  it('renders run-at instead of time/day fields when repeat is oneTime', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
    });

    expect(screen.getByText('Date and time *')).toBeTruthy();
    expect(screen.queryByText('Time *')).toBeNull();
  });

  it('renders no time, day-of-week, or day-of-month fields when repeat is hourly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    expect(screen.queryByText('Time *')).toBeNull();
    expect(screen.queryByText('Day *')).toBeNull();
    expect(screen.queryByText('Day of month')).toBeNull();
    expect(screen.queryByText('Date and time *')).toBeNull();
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

  it('renders date-and-time boundary pickers when repeat is hourly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    expect(screen.getByText('Start date and time')).toBeTruthy();
    expect(screen.getByText('End date and time')).toBeTruthy();
    /* Both boundary pickers switch to the kit's DateTime mode. */
    expect(screen.getAllByText('isDateTimeMode')).toHaveLength(2);
  });

  it('writes datetime-local boundaries when the hourly pickers change', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Hourly },
    });

    fireEvent.change(screen.getByLabelText('Start date and time'), {
      target: { value: '2027-06-15T09:30' },
    });
    fireEvent.change(screen.getByLabelText('End date and time'), {
      target: { value: '2027-06-20T18:45' },
    });

    expect(onFieldChange).toHaveBeenCalledWith('startDate', '2027-06-15T09:30');
    expect(onFieldChange).toHaveBeenCalledWith('endDate', '2027-06-20T18:45');
  });

  it('writes date-only boundaries when a day-based repeat picker changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Daily },
    });

    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2027-06-15' },
    });

    expect(onFieldChange).toHaveBeenCalledWith('startDate', '2027-06-15');
  });

  it('renders the lib-owned time field only for time-based repeats', async () => {
    for (const repeat of [
      ScheduledTaskRepeat.Daily,
      ScheduledTaskRepeat.Weekly,
      ScheduledTaskRepeat.Monthly,
    ]) {
      const { unmount } = await renderForm({
        values: { ...baseValues, repeat },
      });

      expect(screen.getByLabelText('Time *')).toBeTruthy();
      unmount();
    }

    for (const repeat of [
      ScheduledTaskRepeat.OneTime,
      ScheduledTaskRepeat.Hourly,
    ]) {
      const { unmount } = await renderForm({
        values: { ...baseValues, repeat },
      });

      expect(screen.queryByLabelText('Time *')).toBeNull();
      unmount();
    }
  });

  it('renders day-of-week only when repeat is weekly', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Weekly },
    });

    expect(screen.getByText('Day *')).toBeTruthy();
    expect(screen.queryByText('Day of month')).toBeNull();
  });

  it('disables Save when repeat is oneTime and the run-at value is empty', async () => {
    const oneTimeValues = {
      ...baseValues,
      displayName: 'One-shot report',
      modelId: 'gpt-4o',
      prompt: 'Summarize the news',
      repeat: ScheduledTaskRepeat.OneTime,
    };
    const { rerender } = await renderForm({ values: oneTimeValues });

    expect(getSaveButtons()[0].disabled).toBe(true);

    rerender(
      <ScheduledTaskCreateForm
        {...buildFormProps({
          values: { ...oneTimeValues, runAt: '2027-06-15T09:30' },
        })}
      />,
    );

    expect(getSaveButtons()[0].disabled).toBe(false);
  });

  it('disables Save while a submit-time run-at error is set', async () => {
    await renderForm({
      values: {
        ...baseValues,
        displayName: 'One-shot report',
        modelId: 'gpt-4o',
        prompt: 'Summarize the news',
        repeat: ScheduledTaskRepeat.OneTime,
        runAt: '2020-06-15T09:30',
      },
      errors: { runAt: 'Choose a future date and time' },
    });

    expect(getSaveButtons()[0].disabled).toBe(true);
  });

  it('disables the run-at picker while submitting', async () => {
    await renderForm({
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
      isSubmitting: true,
    });

    expect(
      (screen.getByLabelText('Date and time *') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('calls onFieldChange when the once Run at calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.OneTime },
    });

    await userEvent.type(screen.getByLabelText('Date and time *'), 'x');

    expect(onFieldChange).toHaveBeenCalledWith('runAt', '');
  });

  it('converts the selected weekday to values.dayOfWeek (APScheduler Monday=0) when the day-of-week calendar changes', async () => {
    const onFieldChange = vi.fn();
    await renderForm({
      onFieldChange,
      values: { ...baseValues, repeat: ScheduledTaskRepeat.Weekly },
    });

    await userEvent.type(screen.getByLabelText('Day *'), '1');

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

  it('passes a minimum selectable date to both date pickers', async () => {
    await renderForm();

    /* Only the start/end date pickers forward a minDate in a recurring form
       (the time and day-of-week calendars do not), so exactly two markers. */
    expect(screen.getAllByText('hasMinDate').length).toBe(2);
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
