import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundI18nKeys } from '../../../constants/translation-keys';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
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
const deleteScheduledTaskMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  getScheduledTask: (scheduleId: string) => getScheduledTaskMock(scheduleId),
  pauseScheduledTask: (scheduleId: string) =>
    pauseScheduledTaskMock(scheduleId),
  resumeScheduledTask: (scheduleId: string) =>
    resumeScheduledTaskMock(scheduleId),
  deleteScheduledTask: (scheduleId: string) =>
    deleteScheduledTaskMock(scheduleId),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
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
    onDelete,
    isDeleting,
    isDeleted,
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
      deleteButtonLabel: string;
      deletedStateLabel: string;
      activeStatusLabel: string;
      activeStatusAnnouncement?: string;
    };
    onBack: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    isDeleting?: boolean;
    isDeleted?: boolean;
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
      <span>isDeleting:{String(isDeleting)}</span>
      <span>isDeleted:{String(isDeleted)}</span>
      {isDeleted && <span>{labels.deletedStateLabel}</span>}
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
      {onDelete && (
        <button onClick={onDelete} disabled={isDeleting}>
          {labels.deleteButtonLabel}
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} disabled={isDeleting}>
          {labels.editButtonLabel}
        </button>
      )}
      {isActive !== undefined && (
        <>
          <input
            type="checkbox"
            role="switch"
            aria-label={labels.activeStatusLabel}
            checked={isActive}
            disabled={isActiveUpdating || isActiveDisabled || isDeleting}
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
  DangerButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  ConfirmationPopupVariant: { Info: 'info', Danger: 'danger' },
  ConfirmationPopup: ({
    open,
    header,
    description,
    confirmLabel,
    cancelLabel,
    isLoading,
    disableConfirmButton,
    onConfirm,
    onCancel,
    onClose,
  }: {
    open: boolean;
    header: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    disableConfirmButton?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
    onClose?: () => void;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label={header}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose?.();
        }}
      >
        <p>{description}</p>
        <span>dialogIsLoading:{String(isLoading)}</span>
        <button onClick={() => onClose?.()} aria-label="Close dialog">
          x
        </button>
        <button onClick={() => onCancel?.()}>{cancelLabel}</button>
        <button onClick={onConfirm} disabled={disableConfirmButton}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
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

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

    expect(getScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    expect(useScheduledTaskRunsMock).toHaveBeenCalledWith('sched_123', true);
  });

  it('renders NotFoundPage when getScheduledTask resolves with a 404', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    const notFoundError = new Error('not found');
    getScheduledTaskMock.mockRejectedValue(notFoundError);
    getApiErrorStatusMock.mockReturnValue(404);
    renderDetailPage();

    expect(
      await screen.findByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
  });

  it('shows a page-level error with retry on a non-404 task fetch failure', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockRejectedValue(new Error('network down'));
    getApiErrorStatusMock.mockReturnValue(undefined);
    renderDetailPage();

    expect(
      await screen.findByRole('button', {
        name: 'scheduledTasks.list.retryLabel',
      }),
    ).toBeTruthy();

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

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
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

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

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

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

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

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
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

    expect(
      await screen.findByRole('button', {
        name: 'scheduledTasks.list.retryLabel',
      }),
    ).toBeTruthy();

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

    expect(
      await screen.findByRole('button', {
        name: 'scheduledTasks.card.editActionLabel',
      }),
    ).toBeTruthy();
  });

  it('navigates to the edit route for the current task when Edit is activated', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage('sched_123');

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
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

    expect(await screen.findByText('modelLabel:GPT-4.1 mini')).toBeTruthy();
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

    expect(await screen.findByText('modelLabel:unknown-model')).toBeTruthy();
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

    expect(
      await screen.findByText(
        /nextRunLabel:scheduledTasks\.detail\.nextRunLabel/,
      ),
    ).toBeTruthy();
  });

  it('omits nextRunLabel when the task has no nextRunTime', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
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

      const switchEl = await screen.findByRole('switch');
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

      const switchEl = await screen.findByRole('switch');
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

      const switchEl = await screen.findByRole('switch');
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

      const switchEl = await screen.findByRole('switch');
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

      const switchEl = await screen.findByRole('switch');
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

      const switchEl = await screen.findByRole('switch');
      expect(switchEl).toHaveProperty('checked', false);
      expect(switchEl).toHaveProperty('disabled', true);

      await userEvent.click(switchEl);

      expect(pauseScheduledTaskMock).not.toHaveBeenCalled();
      expect(resumeScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('renders the switch disabled for a recurring schedule whose activity window has already ended, without calling pause or resume', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: {
          cron: {
            fields: { hour: '9', minute: '0' },
            endDate: '2020-01-01T00:00:00.000Z',
          },
        },
        triggerType: 'cron',
        isActive: false,
        nextRunTime: undefined,
      });
      renderDetailPage();

      const switchEl = await screen.findByRole('switch');
      expect(switchEl).toHaveProperty('checked', false);
      expect(switchEl).toHaveProperty('disabled', true);

      await userEvent.click(switchEl);

      expect(pauseScheduledTaskMock).not.toHaveBeenCalled();
      expect(resumeScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('remains togglable for a recurring schedule whose activity window has not ended yet', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: {
          cron: {
            fields: { hour: '9', minute: '0' },
            endDate: '2099-01-01T00:00:00.000Z',
          },
        },
        triggerType: 'cron',
        isActive: false,
        nextRunTime: undefined,
      });
      renderDetailPage();

      const switchEl = await screen.findByRole('switch');
      expect(switchEl).toHaveProperty('disabled', false);
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

      const switchEl = await screen.findByRole('switch');
      expect(switchEl).toHaveProperty('disabled', false);

      await userEvent.click(switchEl);

      expect(resumeScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    });
  });

  describe('Delete action', () => {
    const loadedTask = {
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    };

    /** Clicks the header Delete action and returns the now-open dialog element. */
    const openDeleteDialog = async () => {
      const deleteButton = await screen.findByRole('button', {
        name: 'buttons.delete',
      });
      await userEvent.click(deleteButton);
      return screen.getByRole('dialog');
    };

    it('renders Delete once the task has loaded, and opens the confirmation dialog without calling deleteScheduledTask', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      renderDetailPage();

      const dialog = await openDeleteDialog();

      expect(dialog).toBeTruthy();
      expect(deleteScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('does not render Delete while the task is loading or on error', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockReturnValue(new Promise(() => undefined));
      renderDetailPage();

      expect(
        screen.queryByRole('button', { name: 'buttons.delete' }),
      ).not.toBeTruthy();
    });

    it('Cancel closes the dialog and makes no API call', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.cancel' }),
      );

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('Escape closes the dialog and makes no API call', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      renderDetailPage();

      const dialog = await openDeleteDialog();
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('closing via the dialog close control makes no API call', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Close dialog' }),
      );

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteScheduledTaskMock).not.toHaveBeenCalled();
    });

    it('confirming calls deleteScheduledTask exactly once with the current scheduleId', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockResolvedValue(undefined);
      renderDetailPage('sched_123');

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      await waitFor(() =>
        expect(deleteScheduledTaskMock).toHaveBeenCalledOnce(),
      );
      expect(deleteScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    });

    it('disables Active/Edit/Delete while a delete request is in flight, and prevents a second confirm', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        ...loadedTask,
        triggerType: 'cron',
        isActive: true,
      });
      let resolveDelete!: () => void;
      deleteScheduledTaskMock.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
      );
      renderDetailPage();

      const dialog = await openDeleteDialog();
      const confirmButton = within(dialog).getByRole('button', {
        name: 'buttons.delete',
      });
      await userEvent.click(confirmButton);

      expect(deleteScheduledTaskMock).toHaveBeenCalledOnce();
      expect(screen.getByRole('switch')).toHaveProperty('disabled', true);
      expect(
        screen.getByRole('button', {
          name: 'scheduledTasks.card.editActionLabel',
        }),
      ).toHaveProperty('disabled', true);

      // A second confirm activation while pending must not issue a second call.
      await userEvent.click(confirmButton);
      expect(deleteScheduledTaskMock).toHaveBeenCalledOnce();

      resolveDelete();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('on success: closes the dialog, shows a success notification, and navigates to the list', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockResolvedValue(undefined);
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      expect(await screen.findByText('scheduled tasks list')).toBeTruthy();
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('a 404/409 failure keeps the user on the page with the not-found error message', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockRejectedValue(new Error('not found'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 404,
        traceId: undefined,
      });
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      await waitFor(() =>
        expect(showNotificationMock).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: 'scheduledTasks.detail.deleteNotFoundError',
          }),
        ),
      );
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy();
      expect(screen.queryByText('scheduled tasks list')).toBeNull();
    });

    it('a 502 failure keeps the user on the page with the retryable error message', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockRejectedValue(new Error('upstream'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 502,
        traceId: 'trace-xyz',
      });
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      await waitFor(() =>
        expect(showNotificationMock).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: 'scheduledTasks.detail.deleteRetryableError',
            requestId: 'trace-xyz',
          }),
        ),
      );
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy();
    });

    it('a generic failure keeps the user on the page with the generic error message and re-enables retry', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockRejectedValue(new Error('boom'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: undefined,
        traceId: undefined,
      });
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      await waitFor(() =>
        expect(showNotificationMock).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: 'scheduledTasks.detail.deleteGenericError',
          }),
        ),
      );
      expect(screen.getByText('isDeleting:false')).toBeTruthy();
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
  });

  describe('Deleted-state task', () => {
    it('renders isDeleted read-only without enabled Delete/Edit/Active controls, while History still renders', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: {},
        isDeleted: true,
        isActive: true,
      });
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_1',
            status: 'Success',
            startTime: '2026-07-24T09:00:00.000Z',
            endTime: '2026-07-24T09:01:00.000Z',
          },
        ],
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: false,
        loadMore: vi.fn(),
        refetch: vi.fn(),
      });
      renderDetailPage();

      expect(await screen.findByText('isDeleted:true')).toBeTruthy();
      expect(
        screen.getByText('scheduledTasks.detail.deletedStateLabel'),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'buttons.delete' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: 'scheduledTasks.card.editActionLabel',
        }),
      ).toBeNull();
      expect(screen.queryByRole('switch')).toBeNull();
      expect(screen.getByText('runs:1')).toBeTruthy();
    });
  });
});
