import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import ScheduledTaskEditPage from '../ScheduledTaskEditPage';
vi.mock(
  '../../../components/ScheduledTaskSkillField/ScheduledTaskSkillField',
  () => ({
    default: ({
      value,
      onChange,
      isSkillsSupported,
    }: {
      value?: string;
      onChange: (value: string | undefined) => void;
      isSkillsSupported: boolean;
    }) => (
      <input
        aria-label="skillUrl"
        aria-invalid={!isSkillsSupported}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    ),
  }),
);

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const useDeploymentsMock = vi.fn();
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => useDeploymentsMock(),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
}));

const useThemeMock = vi.fn();
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => useThemeMock(),
}));

const getScheduledTaskMock = vi.fn();
const updateScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  getScheduledTask: (scheduleId: string) => getScheduledTaskMock(scheduleId),
  updateScheduledTask: (...args: unknown[]) => updateScheduledTaskMock(...args),
}));

const getApiErrorStatusMock = vi.fn();
const getApiErrorDetailsMock = vi.fn();
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    getApiErrorStatus: (error: unknown) => getApiErrorStatusMock(error),
    getApiErrorDetails: (error: unknown) => getApiErrorDetailsMock(error),
  };
});

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
          <option value="claude-3">Claude 3</option>
        </select>
        <output aria-label="triggerLabelledById">{labelledById}</output>
      </>
    ),
  }),
);

interface FormProps {
  labels: { cancelButtonLabel: string; createButtonLabel: string };
  values: {
    displayName: string;
    modelId: string;
    prompt: string;
    description?: string;
    repeat: string;
    time: string;
    minute?: string;
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
  }: FormProps): ReactNode => (
    <div>
      <span>displayName:{values.displayName}</span>
      <span>modelId:{values.modelId}</span>
      <span>prompt:{values.prompt}</span>
      <span>minute:{values.minute ?? ''}</span>
      <button onClick={onBack}>back</button>
      <input
        aria-label="displayName"
        value={values.displayName}
        onChange={(e) => onFieldChange('displayName', e.target.value)}
      />
      <input
        aria-label="time"
        value={values.time}
        onChange={(e) => onFieldChange('time', e.target.value)}
      />
      <output aria-label="modelLabelId">{modelLabelId}</output>
      {modelSelector}
      {skillSelector}
      {errors.skillUrl && <span>{errors.skillUrl}</span>}
      {errors.displayName && <span>{errors.displayName}</span>}
      <button onClick={onCancel}>{labels.cancelButtonLabel}</button>
      <button
        onClick={onSubmit}
        disabled={isSubmitting || Boolean(errors.skillUrl)}
      >
        {labels.createButtonLabel}
      </button>
    </div>
  ),
}));

const DetailTargetStub = () => <div>scheduled task detail page</div>;

const renderEditPage = (scheduleId = 'sched_123') =>
  render(
    <MemoryRouter initialEntries={[`/scheduled-tasks/${scheduleId}/edit`]}>
      <Routes>
        <Route
          path="/scheduled-tasks/:scheduleId/edit"
          element={<ScheduledTaskEditPage />}
        />
        <Route
          path="/scheduled-tasks/:scheduleId"
          element={<DetailTargetStub />}
        />
      </Routes>
    </MemoryRouter>,
  );

const baseTask = {
  id: 'sched_123',
  displayName: 'Daily summary',
  model: 'gpt-4o',
  prompt: 'Summarize my inbox',
  trigger: { cron: { fields: { hour: '9', minute: '0' } } },
};

describe('ScheduledTaskEditPage', () => {
  it.each([true, false])(
    'allows retry after support recovers with skill selection enabled: %s',
    async (skillSelectionEnabled) => {
      useFeatureFlagMock.mockImplementation(
        (key) => key === 'scheduledTasksEnabled' || skillSelectionEnabled,
      );
      getScheduledTaskMock.mockResolvedValue({
        ...baseTask,
        skillUrl: 'skills/public/report',
      });
      updateScheduledTaskMock.mockRejectedValueOnce(new Error('Unsupported'));
      getApiErrorDetailsMock.mockResolvedValue({
        code: 'scheduledTaskSkillUnsupported',
      });
      const page = () => (
        <MemoryRouter initialEntries={['/scheduled-tasks/sched_123/edit']}>
          <Routes>
            <Route
              path="/scheduled-tasks/:scheduleId/edit"
              element={<ScheduledTaskEditPage />}
            />
            <Route
              path="/scheduled-tasks/:scheduleId"
              element={<DetailTargetStub />}
            />
          </Routes>
        </MemoryRouter>
      );
      const view = render(page());
      fireEvent.change(await screen.findByLabelText('displayName'), {
        target: { value: 'Retained draft' },
      });
      const submit = screen.getByRole('button', { name: 'buttons.save' });
      await userEvent.click(submit);
      await screen.findByText('skillSelector.unsupportedTooltipLabel');
      expect((submit as HTMLButtonElement).disabled).toBe(true);
      view.rerender(page());
      expect((submit as HTMLButtonElement).disabled).toBe(true);

      useDeploymentsMock.mockReturnValue({
        items: [{ id: 'gpt-4o', features: { skillsSupported: false } }],
      });
      view.rerender(page());
      expect((submit as HTMLButtonElement).disabled).toBe(true);
      useDeploymentsMock.mockReturnValue({
        items: [{ id: 'gpt-4o', features: { skillsSupported: true } }],
      });
      view.rerender(page());
      expect(
        screen.queryByText('skillSelector.unsupportedTooltipLabel'),
      ).toBeNull();
      expect((submit as HTMLButtonElement).disabled).toBe(false);

      updateScheduledTaskMock.mockResolvedValueOnce(baseTask);
      await userEvent.click(submit);
      expect(updateScheduledTaskMock).toHaveBeenCalledTimes(2);
      expect(updateScheduledTaskMock.mock.calls[1]).toEqual(
        updateScheduledTaskMock.mock.calls[0],
      );
    },
  );

  it('hydrates skill-only content and preserves the reference when selection is hidden', async () => {
    useFeatureFlagMock.mockImplementation(
      (key) => key === 'scheduledTasksEnabled',
    );
    getScheduledTaskMock.mockResolvedValue({
      ...baseTask,
      prompt: '',
      skillUrl: 'skills/public/report',
    });
    updateScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();
    await screen.findByRole('button', { name: 'buttons.save' });
    expect(screen.queryByLabelText('skillUrl')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));
    await vi.waitFor(() =>
      expect(updateScheduledTaskMock).toHaveBeenCalledWith(
        'sched_123',
        expect.objectContaining({
          prompt: '',
          skillUrl: 'skills/public/report',
        }),
      ),
    );
  });

  it('sends null on explicit removal and keeps the draft on deployment lookup failure', async () => {
    getScheduledTaskMock.mockResolvedValue({
      ...baseTask,
      skillUrl: 'skills/public/report',
    });
    updateScheduledTaskMock.mockRejectedValue(
      new Error('Deployment unavailable'),
    );
    getApiErrorStatusMock.mockReturnValue(404);
    getApiErrorDetailsMock.mockResolvedValue({
      code: 'scheduledTaskDeploymentUnavailable',
    });
    renderEditPage();
    fireEvent.change(await screen.findByLabelText('skillUrl'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('displayName'), {
      target: { value: 'Retained draft' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));
    await vi.waitFor(() =>
      expect(updateScheduledTaskMock).toHaveBeenCalledWith(
        'sched_123',
        expect.objectContaining({
          skillUrl: null,
          displayName: 'Retained draft',
        }),
      ),
    );
    expect(
      (screen.getByLabelText('displayName') as HTMLInputElement).value,
    ).toBe('Retained draft');
    expect(
      screen.queryByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeNull();
  });

  it('blocks a hidden saved skill when the selected model is unsupported', async () => {
    useFeatureFlagMock.mockImplementation(
      (key) => key === 'scheduledTasksEnabled',
    );
    getScheduledTaskMock.mockResolvedValue({
      ...baseTask,
      model: 'unsupported',
      skillUrl: 'skills/public/report',
    });
    renderEditPage();
    expect(
      await screen.findByText('skillSelector.unsupportedTooltipLabel'),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));
    expect(updateScheduledTaskMock).not.toHaveBeenCalled();
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
    useAppConfigMock.mockReturnValue({ status: 'ready' });
    getApiErrorStatusMock.mockReturnValue(undefined);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: undefined });
  });
  /* Always restores real timers, even when a fake-timer test times out
   and skips its own cleanup. */
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the NotFound page when scheduledTasksEnabled is false, without calling getScheduledTask', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderEditPage();

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
    expect(getScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('fetches the task on mount', () => {
    getScheduledTaskMock.mockReturnValue(new Promise(() => undefined));
    renderEditPage();

    expect(getScheduledTaskMock).toHaveBeenCalledWith('sched_123');
  });

  it('renders NotFoundPage when getScheduledTask resolves with a 404', async () => {
    getScheduledTaskMock.mockRejectedValue(new Error('not found'));
    getApiErrorStatusMock.mockReturnValue(404);
    renderEditPage();

    expect(
      await screen.findByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('shows a retryable error state on a non-404 task fetch failure', async () => {
    getScheduledTaskMock.mockRejectedValue(new Error('network down'));
    renderEditPage();

    expect(
      await screen.findByRole('button', {
        name: 'scheduledTasks.list.retryLabel',
      }),
    ).toBeTruthy();

    getScheduledTaskMock.mockResolvedValue(baseTask);
    await userEvent.click(
      screen.getByRole('button', { name: 'scheduledTasks.list.retryLabel' }),
    );

    await waitFor(() => expect(getScheduledTaskMock).toHaveBeenCalledTimes(2));
  });

  it('prefills the form once the task has loaded successfully', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    expect(screen.getByText('modelId:gpt-4o')).toBeTruthy();
    expect(screen.getByText('prompt:Summarize my inbox')).toBeTruthy();
  });

  it('links the model field label to the trigger via a generated id, not a hardcoded literal', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

    const modelLabelId = screen.getByLabelText('modelLabelId').textContent;
    const triggerLabelledById = screen.getByLabelText(
      'triggerLabelledById',
    ).textContent;

    expect(modelLabelId).toBeTruthy();
    expect(triggerLabelledById).toBe(modelLabelId);
  });

  it('preselects the task current deployment in the model selector', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

    const select = screen.getByRole('combobox', {
      name: 'modelId',
    }) as HTMLSelectElement;
    expect(select.value).toBe('gpt-4o');
  });

  it('allows changing the preselected deployment and sends it via PUT on save', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockResolvedValue({ id: 'sched_123' });
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'modelId' }),
      'claude-3',
    );
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(updateScheduledTaskMock).toHaveBeenCalledOnce();
    const body = updateScheduledTaskMock.mock.calls[0][1];
    expect(body.model).toBe('claude-3');
  });

  it('defaults minute to 0 for a non-hourly task, so switching Repeat to Hourly does not start with an empty field', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    expect(screen.getByText('minute:0')).toBeTruthy();
  });

  it('shows a non-destructive message and does not mount the form when the trigger is unsupported', async () => {
    getScheduledTaskMock.mockResolvedValue({
      ...baseTask,
      trigger: { cron: { fields: { hour: '9', minute: '0', week: '2' } } },
    });
    renderEditPage();

    expect(
      await screen.findByText('scheduledTasks.edit.invalidScheduleLabel'),
    ).toBeTruthy();
    expect(screen.queryByText(/displayName:/)).not.toBeTruthy();
  });

  it('shows a non-destructive message when required fields are missing', async () => {
    getScheduledTaskMock.mockResolvedValue({ ...baseTask, model: undefined });
    renderEditPage();

    expect(
      await screen.findByText('scheduledTasks.edit.invalidScheduleLabel'),
    ).toBeTruthy();
  });

  it('navigates to the detail route without a network call when Back is activated', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(screen.getByText('scheduled task detail page')).toBeTruthy();
    expect(updateScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('sends the edited time in the update body as UTC cron fields', async () => {
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

    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockResolvedValue({ id: 'sched_123' });
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    const timeInput = screen.getByLabelText('time');
    await userEvent.clear(timeInput);
    await userEvent.type(timeInput, '08:45');
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(updateScheduledTaskMock).toHaveBeenCalledOnce();
    const fields = updateScheduledTaskMock.mock.calls[0][1].trigger.cron.fields;
    /* The mapper converts the local 08:45 to UTC with a reference Date —
       compute the expectation the same way so the test holds in any
       runner timezone. */
    const reference = new Date();
    reference.setHours(8, 45, 0, 0);
    expect(fields.hour).toBe(String(reference.getUTCHours()));
    expect(fields.minute).toBe(String(reference.getUTCMinutes()));
  });

  it('navigates to the detail route without a network call when Cancel is activated', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(screen.getByText('scheduled task detail page')).toBeTruthy();
    expect(updateScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('calls updateScheduledTask and navigates to the detail route on success', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockResolvedValue({ id: 'sched_123' });
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(updateScheduledTaskMock).toHaveBeenCalledOnce();
    expect(updateScheduledTaskMock.mock.calls[0][0]).toBe('sched_123');
    expect(await screen.findByText('scheduled task detail page')).toBeTruthy();
    expect(showNotificationMock).toHaveBeenCalledOnce();
  });

  it('prevents a second submit while the first call is still pending', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockReturnValue(new Promise(() => undefined));
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'buttons.save' });
    await userEvent.click(saveButton);
    await userEvent.click(saveButton);

    expect(updateScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it('preserves entered values, shows an error notification, and re-enables Save on submit failure', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockRejectedValue(new Error('upstream failure'));
    getApiErrorStatusMock.mockReturnValue(400);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-1' });
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'displayName' }),
      ' edited',
    );
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    await waitFor(() => expect(showNotificationMock).toHaveBeenCalledOnce());
    expect(showNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'trace-1' }),
    );
    expect(screen.queryByText('scheduled task detail page')).not.toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'buttons.save' })
        .hasAttribute('disabled'),
    ).toBe(false);
  });

  it('renders NotFoundPage when updateScheduledTask rejects with a 404', async () => {
    getScheduledTaskMock.mockResolvedValue(baseTask);
    updateScheduledTaskMock.mockRejectedValue(new Error('not found'));
    getApiErrorStatusMock.mockReturnValue(404);
    renderEditPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'buttons.save' }));

    expect(
      await screen.findByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
  });
});
