import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createContext, useContext, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import ScheduledTaskCreatePage from '../ScheduledTaskCreatePage';
vi.mock(
  '../../../components/ScheduledTaskSkillField/ScheduledTaskSkillField',
  () => ({
    default: ({
      value,
      onChange,
      isSkillsSupported,
    }: {
      value: string[];
      onChange: (value: string[]) => void;
      isSkillsSupported: boolean;
    }) => (
      <input
        aria-label="skillUrls"
        aria-invalid={!isSkillsSupported}
        value={value.join(',')}
        onChange={(event) =>
          onChange(event.target.value ? event.target.value.split(',') : [])
        }
      />
    ),
  }),
);

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const useDeploymentsMock = vi.fn();
const TestSkillSupportContext = createContext<boolean | undefined>(undefined);
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => {
    const support = useContext(TestSkillSupportContext);
    return support === undefined
      ? useDeploymentsMock()
      : { items: [{ id: 'gpt-4o', features: { skillsSupported: support } }] };
  },
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
}));

const useThemeMock = vi.fn();
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => useThemeMock(),
}));

const createScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  createScheduledTask: (...args: unknown[]) => createScheduledTaskMock(...args),
}));

vi.mock(
  '../../../components/DeploymentSelector/DeploymentSelectorFieldTrigger',
  () => ({
    default: ({
      selectedId,
      onSelect,
      labelledById,
    }: {
      selectedId: string | null;
      onSelect: (id: string) => void;
      labelledById?: string;
    }) => (
      <>
        <select
          aria-label="modelId"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="" />
          <option value="gpt-4o">GPT-4o</option>
          <option value="unsupported">Unsupported</option>
        </select>
        <output aria-label="triggerLabelledById">{labelledById}</output>
      </>
    ),
  }),
);

const refineTextMock = vi.fn();
vi.mock('../../../server-api/text-refinement.api', () => ({
  refineText: (...args: unknown[]) => refineTextMock(...args),
}));
interface FormProps {
  onRefineDescription?: (value: string, signal: AbortSignal) => Promise<string>;
  onRefineInstructions?: (
    value: string,
    signal: AbortSignal,
  ) => Promise<string>;
  labels: { cancelButtonLabel: string; createButtonLabel: string };
  values: {
    displayName: string;
    modelId: string;
    prompt: string;
    description?: string;
    repeat: string;
    time: string;
    startDate?: string;
    endDate?: string;
    runAt?: string;
  };
  errors: Record<string, string | undefined>;
  skillSelector?: ReactNode;
  modelSelector: ReactNode;
  modelLabelId: string;
  onFieldChange: (field: string, value: unknown) => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

vi.mock('@epam/ai-dial-scheduled-tasks', () => ({
  ScheduledTaskRepeat: {
    OneTime: 'oneTime',
    Hourly: 'hourly',
    Daily: 'daily',
    Weekly: 'weekly',
    Monthly: 'monthly',
  },
  DESCRIPTION_MAX_LENGTH: 500,
  TIME_OF_DAY_PATTERN: /^([01]\d|2[0-3]):([0-5]\d)$/,
  ScheduledTaskCreateForm: ({
    labels,
    values,
    errors,
    skillSelector,
    modelSelector,
    modelLabelId,
    onFieldChange,
    onBack,
    onCancel,
    onSubmit,
    isSubmitting,
    onRefineDescription,
    onRefineInstructions,
  }: FormProps): ReactNode => (
    <div>
      {onRefineDescription && (
        <button
          onClick={async () =>
            onFieldChange(
              'description',
              await onRefineDescription(
                values.description ?? '',
                new AbortController().signal,
              ),
            )
          }
        >
          refine description
        </button>
      )}
      {onRefineInstructions && (
        <button
          onClick={async () =>
            onFieldChange(
              'prompt',
              await onRefineInstructions(
                values.prompt,
                new AbortController().signal,
              ),
            )
          }
        >
          refine instructions
        </button>
      )}
      <button onClick={onBack}>back</button>
      <input
        aria-label="displayName"
        value={values.displayName}
        onChange={(e) => onFieldChange('displayName', e.target.value)}
      />
      <output aria-label="modelLabelId">{modelLabelId}</output>
      {modelSelector}
      {skillSelector}
      {errors.skillUrls && <span>{errors.skillUrls}</span>}
      <textarea
        aria-label="prompt"
        value={values.prompt}
        onChange={(e) => onFieldChange('prompt', e.target.value)}
      />
      <textarea
        aria-label="description"
        value={values.description ?? ''}
        onChange={(e) => onFieldChange('description', e.target.value)}
      />
      <select
        aria-label="repeat"
        value={values.repeat}
        onChange={(e) => onFieldChange('repeat', e.target.value)}
      >
        <option value="oneTime">oneTime</option>
        <option value="hourly">hourly</option>
        <option value="daily">daily</option>
        <option value="weekly">weekly</option>
        <option value="monthly">monthly</option>
      </select>
      <input
        aria-label="startDate"
        value={values.startDate ?? ''}
        onChange={(e) => onFieldChange('startDate', e.target.value)}
      />
      <input
        aria-label="endDate"
        value={values.endDate ?? ''}
        onChange={(e) => onFieldChange('endDate', e.target.value)}
      />
      <input
        aria-label="runAt"
        value={values.runAt ?? ''}
        onChange={(e) => onFieldChange('runAt', e.target.value)}
      />
      <input
        aria-label="time"
        value={values.time}
        onChange={(e) => onFieldChange('time', e.target.value)}
      />
      {errors.displayName && <span>{errors.displayName}</span>}
      {errors.modelId && <span>{errors.modelId}</span>}
      {errors.prompt && <span>{errors.prompt}</span>}
      {errors.description && <span>{errors.description}</span>}
      {errors.startDate && <span>{errors.startDate}</span>}
      {errors.endDate && <span>{errors.endDate}</span>}
      <button onClick={onCancel}>{labels.cancelButtonLabel}</button>
      <button
        onClick={onSubmit}
        disabled={isSubmitting || Boolean(errors.skillUrls)}
      >
        {labels.createButtonLabel}
      </button>
    </div>
  ),
}));

const renderAtRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/scheduled-tasks/new"
          element={<ScheduledTaskCreatePage />}
        />
        <Route path="/scheduled-tasks" element={<div>list page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fillValidForm = async () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'displayName' }), {
    target: { value: 'Daily summary' },
  });
  await userEvent.selectOptions(
    screen.getByRole('combobox', { name: 'modelId' }),
    'gpt-4o',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'prompt' }), {
    target: { value: 'Summarize my inbox' },
  });
};

/* Submit validation reads the real clock, so window boundaries are built
   runtime-relative — a hardcoded date becomes a past date the day after it
   is written. */
const localDateOnly = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

describe('ScheduledTaskCreatePage', () => {
  it('supplies both purpose callbacks only when available and saves their results', async () => {
    useAppConfigMock.mockReturnValue({
      status: 'ready',
      config: { aiTextRefinementAvailable: true },
    });
    refineTextMock
      .mockResolvedValueOnce('Better description')
      .mockResolvedValueOnce('Better instructions');
    createScheduledTaskMock.mockResolvedValue({ id: 'new-task' });
    renderAtRoute('/scheduled-tasks/new');
    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'refine description' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'refine instructions' }),
    );
    expect(refineTextMock).toHaveBeenNthCalledWith(
      1,
      TextRefinementPurpose.ScheduledTaskDescription,
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(refineTextMock).toHaveBeenNthCalledWith(
      2,
      TextRefinementPurpose.ScheduledTaskInstructions,
      'Summarize my inbox',
      expect.any(AbortSignal),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );
    expect(createScheduledTaskMock.mock.calls[0][0]).toMatchObject({
      description: 'Better description',
      prompt: 'Better instructions',
    });
  });
  it('omits both actions when the optional capability is missing', async () => {
    renderAtRoute('/scheduled-tasks/new');
    expect(
      screen.queryByRole('button', { name: 'refine description' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'refine instructions' }),
    ).toBeNull();
  });
  it('allows retry with the same draft after support recovers from a server rejection', async () => {
    createScheduledTaskMock.mockRejectedValueOnce({
      response: new Response(
        JSON.stringify({ code: 'scheduledTaskSkillUnsupported' }),
        { status: 400 },
      ),
    });
    const page = (support = true) => (
      <TestSkillSupportContext value={support}>
        <MemoryRouter>
          <ScheduledTaskCreatePage />
        </MemoryRouter>
      </TestSkillSupportContext>
    );
    const view = render(page());
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('skillUrls'), {
      target: { value: 'skills/public/report' },
    });
    const submit = screen.getByRole('button', { name: 'buttons.create' });
    await userEvent.click(submit);
    await screen.findByText('skillSelector.unsupportedTooltipLabel');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    view.rerender(page());
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    view.rerender(page(false));
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    view.rerender(page(true));
    expect(
      screen.queryByText('skillSelector.unsupportedTooltipLabel'),
    ).toBeNull();
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    createScheduledTaskMock.mockResolvedValueOnce({ id: 'task' });
    await userEvent.click(submit);
    expect(createScheduledTaskMock).toHaveBeenCalledTimes(2);
    expect(createScheduledTaskMock.mock.calls[1][0]).toEqual(
      createScheduledTaskMock.mock.calls[0][0],
    );
  });

  it('saves skill-only content and rejects model switches immediately without losing the selection', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'task' });
    renderAtRoute('/scheduled-tasks/new');
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('skillUrls'), {
      target: { value: 'skills/public/report,skills/public/summary' },
    });
    fireEvent.change(screen.getByLabelText('prompt'), {
      target: { value: '' },
    });
    await userEvent.selectOptions(
      screen.getByLabelText('modelId'),
      'unsupported',
    );
    expect(
      screen.getByText('skillSelector.unsupportedTooltipLabel'),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );
    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect((screen.getByLabelText('skillUrls') as HTMLInputElement).value).toBe(
      'skills/public/report,skills/public/summary',
    );
    await userEvent.selectOptions(screen.getByLabelText('modelId'), 'gpt-4o');
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );
    await vi.waitFor(() =>
      expect(createScheduledTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          skillUrls: ['skills/public/report', 'skills/public/summary'],
          prompt: '',
        }),
      ),
    );
  });

  it('retains the draft and localizes a server capability rejection', async () => {
    createScheduledTaskMock.mockRejectedValue({
      response: new Response(
        JSON.stringify({
          code: 'scheduledTaskSkillUnsupported',
          message: 'Unsupported',
        }),
        { status: 400 },
      ),
    });
    renderAtRoute('/scheduled-tasks/new');
    await fillValidForm();
    fireEvent.change(screen.getByLabelText('skillUrls'), {
      target: { value: 'skills/public/report' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );
    expect(
      await screen.findByText('skillSelector.unsupportedTooltipLabel'),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('displayName') as HTMLInputElement).value,
    ).toBe('Daily summary');
    expect((screen.getByLabelText('prompt') as HTMLInputElement).value).toBe(
      'Summarize my inbox',
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useFeatureFlagMock.mockReturnValue(true);
    useDeploymentsMock.mockReturnValue({
      items: [
        {
          id: 'gpt-4o',
          displayName: 'GPT-4o',
          features: { skillsSupported: true },
        },
        {
          id: 'unsupported',
          displayName: 'Unsupported',
          features: { skillsSupported: false },
        },
      ],
    });
    useThemeMock.mockReturnValue({ currentTheme: 'light' });
    useAppConfigMock.mockReturnValue({ status: 'ready', config: {} });
  });
  /* Always restores real timers, even when a fake-timer test times out
   and skips its own cleanup. */
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a fallback instead of NotFound while app config is still loading', () => {
    useAppConfigMock.mockReturnValue({ status: 'loading' });
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute('/scheduled-tasks/new');

    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
  });

  it('renders the NotFound page when scheduledTasksEnabled is false', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderAtRoute('/scheduled-tasks/new');

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('links the model field label to the trigger via a generated id, not a hardcoded literal', () => {
    renderAtRoute('/scheduled-tasks/new');

    const modelLabelId = screen.getByLabelText('modelLabelId').textContent;
    const triggerLabelledById = screen.getByLabelText(
      'triggerLabelledById',
    ).textContent;

    expect(modelLabelId).toBeTruthy();
    expect(triggerLabelledById).toBe(modelLabelId);
  });

  it('sends the entered time in the create body as UTC cron fields', async () => {
    /*
     * Both the mapper's local→UTC conversion and the expectation below read
     * the wall clock; pin one instant so a minute or DST boundary between
     * them cannot flip the assertion. `shouldAdvanceTime` keeps timers
     * firing so userEvent and async queries still work under the fake clock.
     */
    vi.useFakeTimers({
      now: new Date('2025-06-15T00:00:00Z'),
      shouldAdvanceTime: true,
    });

    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    const timeInput = screen.getByLabelText('time');
    await userEvent.clear(timeInput);
    await userEvent.type(timeInput, '08:45');
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const fields = createScheduledTaskMock.mock.calls[0][0].trigger.cron.fields;
    /* The mapper converts the local 08:45 to UTC with a reference Date —
       compute the expectation the same way so the test holds in any
       runner timezone. */
    const reference = new Date();
    reference.setHours(8, 45, 0, 0);
    expect(fields.hour).toBe(String(reference.getUTCHours()));
    expect(fields.minute).toBe(String(reference.getUTCMinutes()));
  });

  it('navigates to the list route on Cancel', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(screen.getByText('list page')).toBeTruthy();
    expect(createScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('navigates to the list route on back without a network call', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await userEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(screen.getByText('list page')).toBeTruthy();
    expect(createScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('does not submit when required fields are missing', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(screen.getByText('editor.nameRequired')).toBeTruthy();
  });

  it('binds the model selector to values.modelId and updates it on selection', async () => {
    renderAtRoute('/scheduled-tasks/new');

    const select = screen.getByRole('combobox', {
      name: 'modelId',
    }) as HTMLSelectElement;
    expect(select.value).toBe('');

    await userEvent.selectOptions(select, 'gpt-4o');

    expect(select.value).toBe('gpt-4o');
  });

  it('submits the mapped body and navigates to the list route on success', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.displayName).toBe('Daily summary');
    expect(body.model).toBe('gpt-4o');
    expect(body.prompt).toBe('Summarize my inbox');
    expect(body.trigger).toBeDefined();

    expect(await screen.findByText('list page')).toBeTruthy();
    expect(showNotificationMock).toHaveBeenCalledOnce();
  });

  it('includes a trimmed description in the submit body when non-empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'description' }),
      '  Summarizes unread inbox items  ',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.description).toBe('Summarizes unread inbox items');
  });

  it('omits description from the submit body when empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.description).toBeUndefined();
  });

  it('blocks submit and shows a validation error when description exceeds 500 characters', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'description' }), {
      target: { value: 'a'.repeat(501) },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(screen.getByText('editor.fieldTooLong')).toBeTruthy();
  });

  it('blocks submit with an inline error when endDate is earlier than startDate', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    /* Submit validation reads the real clock, so the window is built
       runtime-relative — a hardcoded date becomes a past date the day after
       it is written. */
    fireEvent.change(screen.getByRole('textbox', { name: 'startDate' }), {
      target: { value: localDateOnly(10) },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'endDate' }), {
      target: { value: localDateOnly(5) },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('scheduledTasks.create.endDateBeforeStartError'),
    ).toBeTruthy();
  });

  it('submits a single-day window where endDate equals startDate', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'startDate' }), {
      target: { value: localDateOnly(1) },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'endDate' }), {
      target: { value: localDateOnly(1) },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    expect(
      screen.queryByText('scheduledTasks.create.endDateBeforeStartError'),
    ).toBeNull();
  });

  it('blocks submit with an inline error when startDate is in the past', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'startDate' }), {
      target: { value: localDateOnly(-1) },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('scheduledTasks.create.startDateInPast'),
    ).toBeTruthy();
  });

  it('blocks submit with an inline error when endDate is in the past', async () => {
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'endDate' }), {
      target: { value: localDateOnly(-1) },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      screen.getByText('scheduledTasks.create.endDateInPast'),
    ).toBeTruthy();
  });

  it('allows submit when both startDate and endDate are empty', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it('does not include startDate/endDate in the submit body after switching repeat to one-time', async () => {
    createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    fireEvent.change(screen.getByRole('textbox', { name: 'startDate' }), {
      target: { value: localDateOnly(1) },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'endDate' }), {
      target: { value: localDateOnly(10) },
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'repeat' }),
      'oneTime',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'runAt' }), {
      target: { value: '2099-08-24T09:00' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    const body = createScheduledTaskMock.mock.calls[0][0];
    expect(body.trigger.cron).toBeUndefined();
    expect(body.trigger).not.toHaveProperty('startDate');
    expect(body.trigger).not.toHaveProperty('endDate');
  });

  it('shows an error notification and stays on the form when the API call fails', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('upstream failure'));
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });

    expect(screen.queryByText('list page')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'displayName' })).toHaveProperty(
      'value',
      'Daily summary',
    );
  });

  it('tells the user to contact an administrator when the scheduler consent was revoked', async () => {
    createScheduledTaskMock.mockRejectedValue({
      response: new Response(
        JSON.stringify({ code: 'scheduledTaskAdminConsentRequired' }),
        { status: 403 },
      ),
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'toolsetSignin.adminConsentRequired',
        }),
      );
    });
    expect(screen.getByRole('textbox', { name: 'displayName' })).toHaveProperty(
      'value',
      'Daily summary',
    );
  });

  it("shows DIAL Scheduler's reason instead of the generic server message", async () => {
    createScheduledTaskMock.mockRejectedValue({
      response: new Response(
        JSON.stringify({
          message: 'DIAL Core returned a server error',
          upstreamMessage: 'Quota exceeded for schedules',
        }),
        { status: 502 },
      ),
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Quota exceeded for schedules' }),
      );
    });
  });

  it('falls back to the localized message when Scheduler supplies no reason', async () => {
    createScheduledTaskMock.mockRejectedValue({
      response: new Response(
        JSON.stringify({ message: 'DIAL Core request timed out' }),
        { status: 503 },
      ),
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'scheduledTasks.create.errorNotification',
        }),
      );
    });
  });
});
