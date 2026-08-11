import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import ScheduledTaskDetailPage from '../ScheduledTaskDetailPage';

const useFeatureFlagMock = vi.fn();
const useAppConfigMock = vi.fn();
vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
  useAppConfig: () => useAppConfigMock(),
}));

const useDeploymentsMock = vi.fn();
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => useDeploymentsMock(),
}));

const getScheduledTaskMock = vi.fn();
const pauseScheduledTaskMock = vi.fn();
const resumeScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  getScheduledTask: (scheduleId: string) => getScheduledTaskMock(scheduleId),
  pauseScheduledTask: (scheduleId: string) =>
    pauseScheduledTaskMock(scheduleId),
  resumeScheduledTask: (scheduleId: string) =>
    resumeScheduledTaskMock(scheduleId),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: showNotificationMock }),
}));

const getApiErrorDetailsMock = vi.fn();

const useScheduledTaskRunsMock = vi.fn();
vi.mock('../../../hooks/scheduled-tasks/useScheduledTaskRuns', () => ({
  useScheduledTaskRuns: (scheduleId: string, enabled: boolean) =>
    useScheduledTaskRunsMock(scheduleId, enabled),
}));

const getApiErrorStatusMock = vi.fn();
vi.mock('../../../server-api/api-error', () => ({
  getApiErrorStatus: (error: unknown) => getApiErrorStatusMock(error),
  getApiErrorDetails: (error: unknown) => getApiErrorDetailsMock(error),
}));

vi.mock('@epam/ai-dial-scheduled-tasks', () => ({
  ScheduledTaskRunStatus: {
    Success: 'success',
    Error: 'error',
    InProgress: 'inProgress',
    Missed: 'missed',
  },
  ScheduledTaskDetailView: ({
    labels,
    onBack,
    onEdit,
    isActive,
    isActiveUpdating,
    isActiveDisabled,
    onActiveChange,
    displayName,
    isLoading,
    error,
    onRetry,
    description,
    modelLabel,
    repeatsLabel,
    activeWindowLabel,
    nextRunLabel,
    runs,
    runsError,
    onRunsRetry,
    onRunsLoadMore,
  }: {
    labels: {
      errorLabel: string;
      retryLabel: string;
      historyErrorLabel: string;
      historyRetryLabel: string;
      editButtonLabel: string;
      activeStatusLabel: string;
      activeStatusAnnouncement?: string;
    };
    onBack: () => void;
    onEdit?: () => void;
    isActive?: boolean;
    isActiveUpdating?: boolean;
    isActiveDisabled?: boolean;
    onActiveChange?: (nextActive: boolean) => void;
    displayName: string;
    isLoading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
    description?: string;
    modelLabel?: string;
    repeatsLabel?: string;
    activeWindowLabel?: string;
    nextRunLabel?: string;
    runs: { id: string }[];
    runsError?: Error | null;
    onRunsRetry?: () => void;
    onRunsLoadMore?: () => void;
  }) => (
    <div>
      <span>displayName:{displayName}</span>
      <span>isLoading:{String(isLoading)}</span>
      <span>description:{description}</span>
      <span>modelLabel:{modelLabel}</span>
      <span>repeatsLabel:{repeatsLabel}</span>
      <span>activeWindowLabel:{activeWindowLabel}</span>
      <span>nextRunLabel:{nextRunLabel}</span>
      <span>runs:{runs.length}</span>
      {error && <button onClick={onRetry}>{labels.retryLabel}</button>}
      {runsError && (
        <button onClick={onRunsRetry}>{labels.historyRetryLabel}</button>
      )}
      <button onClick={onRunsLoadMore}>load more runs</button>
      <button onClick={onBack}>back</button>
      {onEdit && <button onClick={onEdit}>{labels.editButtonLabel}</button>}
      {isActive !== undefined && (
        <>
          <input
            type="checkbox"
            role="switch"
            aria-label={labels.activeStatusLabel}
            checked={isActive}
            disabled={isActiveUpdating || isActiveDisabled}
            onChange={(e) => onActiveChange?.(e.target.checked)}
          />
          <span role="status">{labels.activeStatusAnnouncement}</span>
        </>
      )}
    </div>
  ),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  NotificationVariant: { Success: 'success', Error: 'error' },
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  NeutralButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  GhostButton: ({
    label,
    onClick,
    className,
  }: {
    label: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {label}
    </button>
  ),
}));

const BackTargetStub = () => <div>scheduled tasks list</div>;
const EditTargetStub = () => <div>scheduled task edit page</div>;

const renderDetailPage = (scheduleId = 'sched_123') =>
  render(
    <MemoryRouter initialEntries={[`/scheduled-tasks/${scheduleId}`]}>
      <Routes>
        <Route
          path="/scheduled-tasks/:scheduleId"
          element={<ScheduledTaskDetailPage />}
        />
        <Route path="/scheduled-tasks" element={<BackTargetStub />} />
        <Route
          path="/scheduled-tasks/:scheduleId/edit"
          element={<EditTargetStub />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ScheduledTaskDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppConfigMock.mockReturnValue({ status: 'ready' });
    useDeploymentsMock.mockReturnValue({ items: [] });
    useScheduledTaskRunsMock.mockReturnValue({
      items: [],
      isLoading: false,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    });
    getApiErrorStatusMock.mockReturnValue(undefined);
    getApiErrorDetailsMock.mockResolvedValue({ traceId: undefined });
  });

  it('renders NotFound when scheduledTasksEnabled is false, without calling getScheduledTask', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderDetailPage();

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
    expect(getScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('fetches the task and runs concurrently on mount', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );

    expect(getScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    expect(useScheduledTaskRunsMock).toHaveBeenCalledWith('sched_123', true);
  });

  it('renders NotFoundPage when getScheduledTask resolves with a 404', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    const notFoundError = new Error('not found');
    getScheduledTaskMock.mockRejectedValue(notFoundError);
    getApiErrorStatusMock.mockReturnValue(404);
    renderDetailPage();

    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
      ).toBeTruthy(),
    );
  });

  it('shows a page-level error with retry on a non-404 task fetch failure', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockRejectedValue(new Error('network down'));
    getApiErrorStatusMock.mockReturnValue(undefined);
    renderDetailPage();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.list.retryLabel',
        }),
      ).toBeTruthy(),
    );

    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'scheduledTasks.list.retryLabel' }),
    );

    await waitFor(() => expect(getScheduledTaskMock).toHaveBeenCalledTimes(2));
  });

  it('keeps task metadata visible and shows a scoped error when only the runs fetch fails', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    const refetchRuns = vi.fn();
    useScheduledTaskRunsMock.mockReturnValue({
      items: [],
      isLoading: false,
      isLoadingMore: false,
      error: new Error('runs failed'),
      hasMore: false,
      loadMore: vi.fn(),
      refetch: refetchRuns,
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.list.retryLabel',
      }),
    );

    expect(refetchRuns).toHaveBeenCalledOnce();
  });

  it('renders the activity-window label when the cron trigger has both bounds', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {
        cron: {
          fields: { hour: '9', minute: '0' },
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-12-31T23:59:59.999Z',
        },
      },
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );

    expect(
      screen.getByText(
        'activeWindowLabel:scheduledTasks.detail.activeWindowValue',
      ),
    ).toBeTruthy();
  });

  it('omits the activity-window label when the cron trigger has no bounds', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );

    expect(screen.getByText('activeWindowLabel:')).toBeTruthy();
  });

  it('navigates to the list route when back is activated', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(screen.getByText('scheduled tasks list')).toBeTruthy();
  });

  it('does not pass onEdit while the task is loading', () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockReturnValue(new Promise(() => undefined)); // never resolves
    renderDetailPage();

    expect(
      screen.queryByRole('button', {
        name: 'scheduledTasks.card.editActionLabel',
      }),
    ).not.toBeTruthy();
  });

  it('does not pass onEdit when the task fetch fails', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockRejectedValue(new Error('network down'));
    getApiErrorStatusMock.mockReturnValue(undefined);
    renderDetailPage();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.list.retryLabel',
        }),
      ).toBeTruthy(),
    );

    expect(
      screen.queryByRole('button', {
        name: 'scheduledTasks.card.editActionLabel',
      }),
    ).not.toBeTruthy();
  });

  it('passes onEdit once the task has loaded successfully', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.card.editActionLabel',
        }),
      ).toBeTruthy(),
    );
  });

  it('navigates to the edit route for the current task when Edit is activated', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage('sched_123');

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'scheduledTasks.card.editActionLabel',
      }),
    );

    expect(screen.getByText('scheduled task edit page')).toBeTruthy();
  });

  it('resolves the model display name via deployments, falling back to the raw id', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useDeploymentsMock.mockReturnValue({
      items: [{ id: 'gpt-4.1-mini', displayName: 'GPT-4.1 mini' }],
    });
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
      model: 'gpt-4.1-mini',
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('modelLabel:GPT-4.1 mini')).toBeTruthy(),
    );
  });

  it('falls back to the raw model id when unresolved', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    useDeploymentsMock.mockReturnValue({ items: [] });
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
      model: 'unknown-model',
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('modelLabel:unknown-model')).toBeTruthy(),
    );
  });

  it('formats nextRunTime into a localized "Next run" label', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
      nextRunTime: '2026-07-31T09:00:00.000Z',
    });
    renderDetailPage();

    await waitFor(() =>
      expect(
        screen.getByText(/nextRunLabel:scheduledTasks\.detail\.nextRunLabel/),
      ).toBeTruthy(),
    );
  });

  it('omits nextRunLabel when the task has no nextRunTime', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    await waitFor(() =>
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy(),
    );
    expect(screen.getByText('nextRunLabel:').textContent).toBe('nextRunLabel:');
  });

  describe('Active switch', () => {
    const activeTask = {
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
      triggerType: 'cron',
      isActive: true,
      nextRunTime: '2026-07-31T09:00:00.000Z',
    };

    it('toggling off calls pauseScheduledTask exactly once and reflects the paused state on success', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      pauseScheduledTaskMock.mockResolvedValue({
        ...activeTask,
        isActive: false,
        nextRunTime: undefined,
      });
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      expect(switchEl).toHaveProperty('checked', true);

      await userEvent.click(switchEl);

      expect(pauseScheduledTaskMock).toHaveBeenCalledOnce();
      expect(pauseScheduledTaskMock).toHaveBeenCalledWith('sched_123');
      expect(resumeScheduledTaskMock).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('checked', false),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('toggling on calls resumeScheduledTask exactly once and reflects the resumed state on success', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        ...activeTask,
        isActive: false,
        nextRunTime: undefined,
      });
      resumeScheduledTaskMock.mockResolvedValue(activeTask);
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      expect(switchEl).toHaveProperty('checked', false);

      await userEvent.click(switchEl);

      expect(resumeScheduledTaskMock).toHaveBeenCalledOnce();
      expect(resumeScheduledTaskMock).toHaveBeenCalledWith('sched_123');
      expect(pauseScheduledTaskMock).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('checked', true),
      );
    });

    it('disables the switch while a pause/resume request is in flight', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      let resolvePause!: (value: typeof activeTask) => void;
      pauseScheduledTaskMock.mockReturnValue(
        new Promise((resolve) => {
          resolvePause = resolve;
        }),
      );
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      await userEvent.click(switchEl);

      expect(screen.getByRole('switch')).toHaveProperty('disabled', true);

      resolvePause({ ...activeTask, isActive: false });
      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('disabled', false),
      );
    });

    it('rolls back to the previous state and shows an error notification with the trace id on failure', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      pauseScheduledTaskMock.mockRejectedValue(new Error('upstream error'));
      getApiErrorDetailsMock.mockResolvedValue({ traceId: 'trace-abc' });
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      await userEvent.click(switchEl);

      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('checked', true),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          requestId: 'trace-abc',
        }),
      );
      // The rest of the page remains visible after a failed toggle.
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy();
    });

    it('does not update state when the response resolves after the page has unmounted', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      let resolvePause!: (value: typeof activeTask) => void;
      pauseScheduledTaskMock.mockReturnValue(
        new Promise((resolve) => {
          resolvePause = resolve;
        }),
      );
      const { unmount } = renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      await userEvent.click(switchEl);

      unmount();

      // Resolving after unmount must not trigger a setState-on-unmounted-component warning/error.
      resolvePause({ ...activeTask, isActive: false });
      await Promise.resolve();
    });

    it('renders the switch disabled for a completed one-time schedule, without calling pause or resume', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: { date: '2026-07-24T09:00:00.000Z' },
        triggerType: 'date',
        isActive: false,
        nextRunTime: undefined,
      });
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      expect(switchEl).toHaveProperty('checked', false);
      expect(switchEl).toHaveProperty('disabled', true);

      await userEvent.click(switchEl);

      expect(pauseScheduledTaskMock).not.toHaveBeenCalled();
      expect(resumeScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('remains togglable for a recurring schedule with no upcoming run (paused, not completed)', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: { cron: { fields: { hour: '9', minute: '0' } } },
        triggerType: 'cron',
        isActive: false,
        nextRunTime: undefined,
      });
      resumeScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: { cron: { fields: { hour: '9', minute: '0' } } },
        triggerType: 'cron',
        isActive: true,
      });
      renderDetailPage();

      const switchEl = await waitFor(() => screen.getByRole('switch'));
      expect(switchEl).toHaveProperty('disabled', false);

      await userEvent.click(switchEl);

      expect(resumeScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    });
  });
});
