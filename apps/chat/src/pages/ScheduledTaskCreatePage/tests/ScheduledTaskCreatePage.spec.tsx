import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  createMemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotFoundI18nKeys,
  UnsavedChangesI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import { UnsavedChangesProvider } from '../../../context/UnsavedChangesContext';
import { renderWithLeaveGuard } from '../../../hooks/unsaved-changes/tests/render-with-leave-guard';
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
const dismissNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () =>
    createNotificationContextValue(showNotificationMock, {
      dismissNotification: dismissNotificationMock,
    }),
}));

const getApiErrorStatusMock = vi.fn();
const getApiErrorDetailsMock = vi.fn();
const checkScheduledTaskAuthSessionErrorMock = vi.fn();
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    /* Fall back to the real parsers unless a test stubs an explicit
       outcome, so pre-existing tests that drive real error shapes
       through getApiErrorDetails keep working unchanged. */
    getApiErrorStatus: (error: unknown) =>
      getApiErrorStatusMock(error) ?? actual.getApiErrorStatus(error),
    getApiErrorDetails: (error: unknown) =>
      getApiErrorDetailsMock(error) ?? actual.getApiErrorDetails(error),
    checkScheduledTaskAuthSessionError: (...args: unknown[]) =>
      checkScheduledTaskAuthSessionErrorMock(...args),
  };
});

const autoLoginMock = vi.fn();
vi.mock('../../../hooks/scheduled-tasks/useScheduledTaskAuthAutoLogin', () => ({
  useScheduledTaskAuthAutoLogin: () => ({
    autoLogin: (...args: unknown[]) => autoLoginMock(...args),
  }),
}));

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

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

vi.mock('@epam/ai-dial-scheduled-tasks', async (importOriginal) => ({
  hasScheduledTaskFormChanges: (
    await importOriginal<typeof import('@epam/ai-dial-scheduled-tasks')>()
  ).hasScheduledTaskFormChanges,
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
  renderWithLeaveGuard(
    <Routes>
      <Route
        path="/scheduled-tasks/new"
        element={<ScheduledTaskCreatePage />}
      />
      <Route path="/scheduled-tasks" element={<div>list page</div>} />
      <Route path="/catalog" element={<div>catalog page</div>} />
    </Routes>,
    [initialEntry],
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
    const router = createMemoryRouter([
      {
        path: '*',
        element: (
          <UnsavedChangesProvider>
            <ScheduledTaskCreatePage />
          </UnsavedChangesProvider>
        ),
      },
    ]);
    const page = (support = true) => (
      <TestSkillSupportContext value={support}>
        <RouterProvider router={router} />
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
    /* Matches the real check's non-throwing contract — it never resolves
       undefined, so an unconfigured mock must not model that impossible
       state (the handler dereferences the result unguarded). */
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: false,
    });
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

  /*
   * The login-required toast itself is not rendered by this harness (the
   * notification context is mocked), so its action element mounts on its own
   * for the click — the latest shown notification carries the live one.
   */
  const clickLoginAndRetryAction = async () => {
    const lastCall = showNotificationMock.mock.calls.at(-1);
    if (lastCall == null) {
      throw new Error('no notification shown yet');
    }
    const { action } = lastCall[0] as { action: ReactElement };
    const { unmount } = render(action);
    try {
      await userEvent.click(
        screen.getByRole('button', {
          name: 'scheduledTasks.loginAndRetryAction',
        }),
      );
    } finally {
      unmount();
    }
  };

  it('shows the login-required toast with a Log in and retry action when a 403 is attributed to the logged-out scheduler service', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    const payload = showNotificationMock.mock.calls[0][0];
    expect(payload.message).toBe('scheduledTasks.loginRequiredNotification');
    expect(payload.requestId).toBe('trace-403');
    expect(payload.action).toBeTruthy();
    /* The login waits for the user's consent — nothing is invoked automatically. */
    expect(autoLoginMock).not.toHaveBeenCalled();
    /* One submit attempt only — the retry happens after the login. */
    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it('logs in through the toast action, retries the create, and navigates to the return route', async () => {
    createScheduledTaskMock
      .mockRejectedValueOnce(new Error('forbidden'))
      .mockResolvedValueOnce({ id: 'sched_new' });
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    autoLoginMock.mockResolvedValue({ type: 'success' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    await clickLoginAndRetryAction();

    /* The login runs on the action's fresh user activation — the page never unloads. */
    expect(autoLoginMock).toHaveBeenCalledOnce();
    expect(autoLoginMock).toHaveBeenCalledWith(CONNECT);
    /* The actionable toast is dismissed once its action runs. */
    expect(dismissNotificationMock).toHaveBeenCalledOnce();
    /* The submit is retried once after the successful login. */
    await vi.waitFor(() => {
      expect(createScheduledTaskMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('list page')).toBeTruthy();
    /* The login-required toast plus the normal success toast. */
    expect(showNotificationMock).toHaveBeenCalledTimes(2);
  });

  it('shows the login-failed toast and keeps the form when the login from the toast action fails', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    autoLoginMock.mockResolvedValue({ type: 'failure' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    await clickLoginAndRetryAction();

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledTimes(2);
    });
    expect(showNotificationMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.autoLoginFailedNotification',
        requestId: 'trace-403',
      }),
    );
    /* One submit attempt only — a failed login never triggers the retry. */
    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
    /* The form and its entered values stay intact — no navigation. */
    expect(screen.queryByText('list page')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'displayName' })).toHaveProperty(
      'value',
      'Daily summary',
    );
  });

  it('stays silent and keeps the form when the user cancels the login from the toast action', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    autoLoginMock.mockResolvedValue({ type: 'cancelled' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    await clickLoginAndRetryAction();

    await vi.waitFor(() => {
      expect(autoLoginMock).toHaveBeenCalledOnce();
    });
    /* A user-cancelled login is not a failure — no login-failed toast, no retry. */
    expect(showNotificationMock).toHaveBeenCalledOnce();
    expect(createScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it('re-runs the full login path when Save is activated again after a failed login', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: CONNECT,
    });
    autoLoginMock.mockResolvedValue({ type: 'failure' });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    const submit = screen.getByRole('button', { name: 'buttons.create' });
    await userEvent.click(submit);
    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    await clickLoginAndRetryAction();
    await vi.waitFor(() => {
      expect(autoLoginMock).toHaveBeenCalledOnce();
    });

    /* A fresh Save activation gets a fresh login-required toast. */
    await userEvent.click(submit);
    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledTimes(3);
    });
    await clickLoginAndRetryAction();

    await vi.waitFor(() => {
      expect(autoLoginMock).toHaveBeenCalledTimes(2);
    });
    expect(createScheduledTaskMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the generic error toast when a 403 is attributed but no usable client settings exist', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: true,
      connect: undefined,
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
        requestId: 'trace-403',
      }),
    );
    expect(autoLoginMock).not.toHaveBeenCalled();
  });

  it('keeps the generic error toast when a 403 is not attributed to the auth session', async () => {
    createScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
    getApiErrorStatusMock.mockReturnValue(403);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-403' });
    checkScheduledTaskAuthSessionErrorMock.mockResolvedValue({
      isAuthSessionError: false,
    });
    renderAtRoute('/scheduled-tasks/new');

    await fillValidForm();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.create' }),
    );

    await vi.waitFor(() => {
      expect(showNotificationMock).toHaveBeenCalledOnce();
    });
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'scheduledTasks.create.errorNotification',
        requestId: 'trace-403',
      }),
    );
    expect(autoLoginMock).not.toHaveBeenCalled();
  });

  describe('leave guard', () => {
    it('opens the shared dialog exactly once when an edited form leaves through navigation', async () => {
      const { router } = renderAtRoute('/scheduled-tasks/new');
      fireEvent.change(screen.getByRole('textbox', { name: 'displayName' }), {
        target: { value: 'Draft' },
      });

      await act(() => router.navigate('/catalog'));

      expect(
        screen.getAllByRole('dialog', { name: UnsavedChangesI18nKeys.Title }),
      ).toHaveLength(1);
      expect(router.state.location.pathname).toBe('/scheduled-tasks/new');
    });

    it('lands on the chosen route when changes are discarded', async () => {
      const { router } = renderAtRoute('/scheduled-tasks/new');
      fireEvent.change(screen.getByRole('textbox', { name: 'displayName' }), {
        target: { value: 'Draft' },
      });
      await act(() => router.navigate('/catalog'));

      await userEvent.click(
        screen.getByRole('button', {
          name: UnsavedChangesI18nKeys.ConfirmLabel,
        }),
      );

      expect(await screen.findByText('catalog page')).toBeTruthy();
      expect(createScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('routes an edited Cancel through the same dialog', async () => {
      renderAtRoute('/scheduled-tasks/new');
      fireEvent.change(screen.getByRole('textbox', { name: 'displayName' }), {
        target: { value: 'Draft' },
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'buttons.cancel' }),
      );

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.queryByText('list page')).toBeNull();
    });

    it('leaves a reverted form immediately', async () => {
      renderAtRoute('/scheduled-tasks/new');
      const name = screen.getByRole('textbox', { name: 'displayName' });
      fireEvent.change(name, { target: { value: 'Draft' } });
      fireEvent.change(name, { target: { value: '' } });

      await userEvent.click(
        screen.getByRole('button', { name: 'buttons.cancel' }),
      );

      expect(screen.getByText('list page')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('exits after a successful create without the dialog', async () => {
      createScheduledTaskMock.mockResolvedValue({ id: 'sched_1' });
      renderAtRoute('/scheduled-tasks/new');
      await fillValidForm();

      await userEvent.click(
        screen.getByRole('button', { name: 'buttons.create' }),
      );

      expect(await screen.findByText('list page')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
