import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  NotFoundI18nKeys,
} from '../../../constants/translation-keys';
import {
  useAppConfig as useAppConfigMock,
  useFeatureFlag as useFeatureFlagMock,
} from '../../../context/tests/app-config-context-mock';
import { createNotificationContextValue } from '../../../context/tests/notification-context-mock';
import ScheduledTaskDetailPage from '../ScheduledTaskDetailPage';
vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({ skills: [], publicSkills: [], sharedWithMe: [] }),
}));
vi.mock('../../../server-api/skills.api', () => ({
  getSkillMetadata: vi.fn().mockRejectedValue(new Error('Unavailable')),
}));

vi.mock(
  '../../../context/AppConfigContext',
  async () => import('../../../context/tests/app-config-context-mock'),
);

const useDeploymentsMock = vi.fn();
vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => useDeploymentsMock(),
}));

const useConversationsMock = vi.fn();
const refreshConversationsMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../context/ConversationsContext', () => ({
  useConversations: () => ({
    refreshConversations: refreshConversationsMock,
    ...useConversationsMock(),
  }),
}));

const getScheduledTaskMock = vi.fn();
const pauseScheduledTaskMock = vi.fn();
const resumeScheduledTaskMock = vi.fn();
const deleteScheduledTaskMock = vi.fn();
const startScheduledTaskMock = vi.fn();
const getScheduledTaskRunMock = vi.fn();
vi.mock('../../../server-api/scheduled-tasks.api', () => ({
  getScheduledTask: (scheduleId: string) => getScheduledTaskMock(scheduleId),
  pauseScheduledTask: (scheduleId: string) =>
    pauseScheduledTaskMock(scheduleId),
  resumeScheduledTask: (scheduleId: string) =>
    resumeScheduledTaskMock(scheduleId),
  deleteScheduledTask: (scheduleId: string) =>
    deleteScheduledTaskMock(scheduleId),
  startScheduledTask: (scheduleId: string) =>
    startScheduledTaskMock(scheduleId),
  getScheduledTaskRun: (...args: unknown[]) => getScheduledTaskRunMock(...args),
}));

const showNotificationMock = vi.fn();
vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => createNotificationContextValue(showNotificationMock),
}));

const getApiErrorDetailsMock = vi.fn();

const useOfflineCredentialsGateMock = vi.fn();
vi.mock('../../../hooks/offlineCredentials/useOfflineCredentialsGate', () => ({
  OfflineCredentialsGateStatus: {
    Checking: 'checking',
    Hidden: 'hidden',
    Available: 'available',
    Unavailable: 'unavailable',
    Error: 'error',
  },
  useOfflineCredentialsGate: () => useOfflineCredentialsGateMock(),
}));

const loginOfflineCredentialsMock = vi.fn();
vi.mock('../../../hooks/offlineCredentials/useOfflineCredentialsLogin', () => ({
  OfflineCredentialsLoginOutcomeType: {
    Success: 'success',
    Failure: 'failure',
    PopupBlocked: 'popup-blocked',
    Cancelled: 'cancelled',
    TimedOut: 'timed-out',
  },
  useOfflineCredentialsLogin: () => ({ login: loginOfflineCredentialsMock }),
}));

vi.mock(
  '../../../components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner',
  () => ({
    ScheduledTasksLoginBannerState: {
      Shown: 'shown',
      LoginInProgress: 'login-in-progress',
      RetryPopupBlocked: 'retry-popup-blocked',
      RetryCancelled: 'retry-cancelled',
      RetryTimeout: 'retry-timeout',
      RetryFailed: 'retry-failed',
    },
    default: ({
      state,
      title,
      body,
      loginButtonLabel,
      retryButtonLabel,
      loggingInLabel,
      liveAnnouncement,
      onLogIn,
    }: {
      state?: string;
      title: string;
      body: string;
      loginButtonLabel: string;
      retryButtonLabel: string;
      loggingInLabel: string;
      liveAnnouncement: string;
      onLogIn?: () => void;
    }) => {
      if (!state) {
        return <span role="status">{liveAnnouncement}</span>;
      }

      let primaryLabel = loginButtonLabel;
      if (state === 'login-in-progress') {
        primaryLabel = loggingInLabel;
      } else if (state.startsWith('retry-')) {
        primaryLabel = retryButtonLabel;
      }

      return (
        <div role="alert">
          <span>{title}</span>
          <span>{body}</span>
          {onLogIn && (
            <button
              type="button"
              disabled={state === 'login-in-progress'}
              onClick={onLogIn}
            >
              {primaryLabel}
            </button>
          )}
          <span role="status">{liveAnnouncement}</span>
        </div>
      );
    },
  }),
);

const useScheduledTaskRunsMock = vi.fn();
vi.mock('../../../hooks/scheduled-tasks/useScheduledTaskRuns', () => ({
  useScheduledTaskRuns: (
    scheduleId: string,
    enabled: boolean,
    nextRunTime?: string | null,
  ) => useScheduledTaskRunsMock(scheduleId, enabled, nextRunTime),
}));

const getApiErrorStatusMock = vi.fn();
vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>();
  return {
    ...actual,
    getApiErrorStatus: (error: unknown) => getApiErrorStatusMock(error),
    getApiErrorDetails: (error: unknown) => getApiErrorDetailsMock(error),
  };
});

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
    onStartNow,
    onDelete,
    isDeleting,
    isStarting,
    isStartNowDisabled,
    isStartNowBusy,
    isDeleted,
    isCompleted,
    isActive,
    isActiveUpdating,
    isActiveDisabled,
    activeDisabledReason,
    onActiveChange,
    displayName,
    isLoading,
    error,
    onRetry,
    description,
    modelLabel,
    skillDisplayNames,
    repeatsLabel,
    activeWindowLabel,
    completedLabel,
    nextRunLabel,
    runs,
    runsError,
    onRunsRetry,
    onRunsLoadMore,
    onRunClick,
  }: {
    labels: {
      errorLabel: string;
      retryLabel: string;
      historyErrorLabel: string;
      historyRetryLabel: string;
      editButtonLabel: string;
      startNowButtonLabel?: string;
      startNowBusyLabel?: string;
      deleteButtonLabel: string;
      deletedStateLabel: string;
      activeStatusLabel: string;
      activeStatusAnnouncement?: string;
      startStatusAnnouncement?: string;
      completedFieldLabel: string;
      codeBlockCopyLabel?: string;
      codeBlockCopiedLabel?: string;
      codeBlockDownloadLabel?: string;
      tableScrollRegionAriaLabel?: string;
      mathScrollRegionAriaLabel?: string;
    };
    onBack: () => void;
    onEdit?: () => void;
    onStartNow?: () => void;
    onDelete?: () => void;
    isDeleting?: boolean;
    isStarting?: boolean;
    isStartNowDisabled?: boolean;
    isStartNowBusy?: boolean;
    isDeleted?: boolean;
    isCompleted?: boolean;
    isActive?: boolean;
    isActiveUpdating?: boolean;
    isActiveDisabled?: boolean;
    activeDisabledReason?: string;
    onActiveChange?: (nextActive: boolean) => void;
    displayName: string;
    isLoading?: boolean;
    error?: Error | null;
    onRetry?: () => void;
    description?: string;
    modelLabel?: string;
    skillDisplayNames?: string[];
    repeatsLabel?: string;
    activeWindowLabel?: string;
    completedLabel?: string;
    nextRunLabel?: string;
    runs: { id: string; conversationId?: string; isUnread?: boolean }[];
    runsError?: Error | null;
    onRunsRetry?: () => void;
    onRunsLoadMore?: () => void;
    onRunClick?: (run: {
      id: string;
      conversationId?: string;
      isUnread?: boolean;
    }) => void;
  }) => (
    <div>
      <span>displayName:{displayName}</span>
      <span>isLoading:{String(isLoading)}</span>
      <span>isDeleting:{String(isDeleting)}</span>
      <span>isDeleted:{String(isDeleted)}</span>
      {isDeleted && <span>{labels.deletedStateLabel}</span>}
      <span>description:{description}</span>
      <span>modelLabel:{modelLabel}</span>
      <span>skill:{skillDisplayNames}</span>
      <span>repeatsLabel:{repeatsLabel}</span>
      <span>activeWindowLabel:{activeWindowLabel}</span>
      {completedLabel && <span>completedLabel:{completedLabel}</span>}
      {activeDisabledReason && (
        <span>disabledReason:{activeDisabledReason}</span>
      )}
      <span>nextRunLabel:{nextRunLabel}</span>
      <span>runs:{runs.length}</span>
      <span>
        markdownLabels:
        {[
          labels.codeBlockCopyLabel,
          labels.codeBlockCopiedLabel,
          labels.codeBlockDownloadLabel,
          labels.tableScrollRegionAriaLabel,
          labels.mathScrollRegionAriaLabel,
        ].join('|')}
      </span>
      {labels.startStatusAnnouncement && (
        <span role="status">{labels.startStatusAnnouncement}</span>
      )}
      {runs.map((run) => (
        <button key={run.id} onClick={() => onRunClick?.(run)}>
          run:{run.id}:{run.isUnread ? 'unread' : 'read'}
        </button>
      ))}
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
      {onStartNow && (
        <button
          onClick={onStartNow}
          disabled={isStarting || isStartNowDisabled || isStartNowBusy}
        >
          {isStarting ? 'starting' : labels.startNowButtonLabel}
        </button>
      )}
      {isStartNowBusy && labels.startNowBusyLabel && (
        <span>busyReason:{labels.startNowBusyLabel}</span>
      )}
      {!isDeleted && !isCompleted && isActive !== undefined && (
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
  DIAL_KIT_ICON_STROKE: 1.5,
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
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
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
}));

/*
 * The delete dialog is a component of its own with its own spec; this mock
 * reproduces just the surface the page's Delete action tests drive — a
 * named dialog with confirm, cancel, close, and Escape dismissal — without
 * depending on the kit's Popup internals.
 */
vi.mock(
  '../../../components/ScheduledTaskDeleteModal/ScheduledTaskDeleteModal',
  () => ({
    default: ({
      open,
      onConfirm,
      onClose,
    }: {
      open: boolean;
      onConfirm: () => void;
      onClose: () => void;
    }) =>
      open ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-label="scheduledTasks.detail.deleteConfirmTitle"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose?.();
          }}
        >
          <button onClick={() => onClose?.()} aria-label="Close dialog">
            <IconX
              size={DIAL_ICON_SIZE.SM}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          </button>
          <button onClick={() => onClose?.()}>buttons.cancel</button>
          <button onClick={onConfirm}>buttons.delete</button>
        </div>
      ) : null,
  }),
);

const BackTargetStub = () => <div>scheduled tasks list</div>;
const EditTargetStub = () => <div>scheduled task edit page</div>;
const ConversationTargetStub = () => <div>conversation view</div>;

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
        <Route path="/conversations/*" element={<ConversationTargetStub />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ScheduledTaskDetailPage', () => {
  it('passes a deleted skill reference to the read-only detail without failing the page', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      prompt: '',
      skillUrls: ['skills/public/deleted'],
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
    });
    renderDetailPage();
    expect(await screen.findByText('skill:skills/public/deleted')).toBeTruthy();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    refreshConversationsMock.mockReset().mockResolvedValue(undefined);
    useAppConfigMock.mockReturnValue({ status: 'ready' });
    useDeploymentsMock.mockReturnValue({ items: [] });
    useConversationsMock.mockReturnValue({ conversations: [] });
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
    startScheduledTaskMock.mockReset();
    getScheduledTaskRunMock.mockReset();
    useOfflineCredentialsGateMock.mockReturnValue({
      status: 'hidden',
      connect: undefined,
      refetch: vi.fn(),
    });
    loginOfflineCredentialsMock.mockReset();
  });

  it('renders NotFound when scheduledTasksEnabled is false, without calling getScheduledTask', () => {
    useFeatureFlagMock.mockReturnValue(false);
    renderDetailPage();

    expect(
      screen.getByRole('region', { name: NotFoundI18nKeys.Title }),
    ).toBeTruthy();
    expect(getScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('passes translated code-block, table and formula labels for the built-in instructions viewer', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    renderDetailPage();

    expect(
      await screen.findByText(
        `markdownLabels:${[
          ButtonsI18nKeys.Copy,
          ButtonsI18nKeys.Copied,
          ButtonsI18nKeys.Download,
          ChatI18nKeys.ScrollableTable,
          ChatI18nKeys.ScrollableFormula,
        ].join('|')}`,
      ),
    ).toBeTruthy();
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
    expect(useScheduledTaskRunsMock).toHaveBeenCalledWith(
      'sched_123',
      true,
      undefined,
    );
  });

  it('prepends an accepted manual run without hiding it behind pending History', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    useScheduledTaskRunsMock.mockReturnValue({
      items: [],
      isLoading: true,
      isLoadingMore: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      refetch: vi.fn(),
    });
    startScheduledTaskMock.mockResolvedValue({
      id: 'run_started',
      status: 'InProgress',
      startTime: '2026-09-30T09:00:00Z',
    });
    renderDetailPage();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );

    expect(startScheduledTaskMock).toHaveBeenCalledWith('sched_123');
    expect(await screen.findByText('runs:1')).toBeTruthy();
    expect(
      screen
        .getByText('scheduledTasks.detail.startAccepted')
        .getAttribute('role'),
    ).toBe('status');
    expect(showNotificationMock).toHaveBeenCalled();
  });

  it.each([true, false])(
    'refreshes unread metadata when the manual chat appears (accepted: %s)',
    async (hasAcceptedChat) => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Task',
        trigger: {},
      });
      const run = {
        id: 'new_run',
        status: 'InProgress',
        startTime: '2026-09-30T09:00:00Z',
      };
      const conversationId =
        'conversations/bucket/.scheduler/sched_123/new_run';
      startScheduledTaskMock.mockResolvedValue({
        ...run,
        conversationId: hasAcceptedChat ? conversationId : undefined,
      });
      getScheduledTaskRunMock.mockResolvedValue({
        ...run,
        conversationId,
        status: 'Success',
      });
      refreshConversationsMock.mockImplementation(async () => {
        useConversationsMock.mockReturnValue({
          conversations: [{ id: conversationId, isUnread: true }],
        });
      });
      renderDetailPage();
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'scheduledTasks.detail.startNow',
        }),
      );
      expect(refreshConversationsMock).toHaveBeenCalledTimes(
        hasAcceptedChat ? 1 : 0,
      );
      await screen.findByText(
        'scheduledTasks.detail.runFinished',
        {},
        { timeout: 5000 },
      );
      await waitFor(() =>
        expect(refreshConversationsMock).toHaveBeenCalledTimes(
          hasAcceptedChat ? 2 : 1,
        ),
      );
      expect(refreshConversationsMock).toHaveBeenLastCalledWith([
        conversationId,
      ]);
      expect(
        await screen.findByRole('button', { name: 'run:new_run:unread' }),
      ).toBeTruthy();
      await userEvent.click(
        screen.getByRole('button', { name: 'run:new_run:unread' }),
      );
      expect(await screen.findByText('conversation view')).toBeTruthy();
    },
  );

  it('does not notify after leaving while a start error is being decoded', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      trigger: {},
    });
    startScheduledTaskMock.mockRejectedValue(new Error('deleted'));
    let resolveDetails!: (details: { status: number }) => void;
    getApiErrorDetailsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveDetails = resolve;
      }),
    );
    const { unmount } = renderDetailPage();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );
    await waitFor(() => expect(getApiErrorDetailsMock).toHaveBeenCalled());
    unmount();
    await act(async () => {
      resolveDetails({ status: 409 });
    });
    expect(showNotificationMock).not.toHaveBeenCalled();
  });

  it('announces the accepted run once after duplicate activation', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      trigger: {},
    });
    startScheduledTaskMock.mockResolvedValue({
      id: 'run_started',
      status: 'InProgress',
      startTime: '2026-09-30T09:00:00Z',
    });
    renderDetailPage();
    const button = await screen.findByRole('button', {
      name: 'scheduledTasks.detail.startNow',
    });
    // eslint-disable-next-line testing-library/no-unnecessary-act -- Both activations must occur before React commits the disabled button.
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await screen.findByText('scheduledTasks.detail.startAccepted');
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
    expect(showNotificationMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('busyReason:scheduledTasks.detail.startBusy'),
    ).toBeTruthy();
  });

  it('starts again after a polled completion even while History still reports InProgress', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      trigger: {},
    });
    const run = {
      id: 'run_started',
      status: 'InProgress',
      startTime: '2026-09-30T09:00:00Z',
    };
    startScheduledTaskMock.mockResolvedValue(run);
    getScheduledTaskRunMock.mockImplementation(async () => {
      useScheduledTaskRunsMock.mockReturnValue({
        items: [run],
        isLoading: false,
        hasMore: false,
        error: null,
      });
      return { ...run, status: 'Success' };
    });
    renderDetailPage();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );
    await screen.findByText(
      'scheduledTasks.detail.runFinished',
      {},
      { timeout: 5000 },
    );
    const button = screen.getByRole('button', {
      name: 'scheduledTasks.detail.startNow',
    });
    expect(button).toHaveProperty('disabled', false);
    startScheduledTaskMock.mockResolvedValue({ ...run, id: 'run_2' });
    await userEvent.click(button);
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(2);
  });

  it('rechecks a previously connected credential gate when a new run fails at credentials', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      trigger: {},
    });
    const connect = {
      clientId: 'offline-client',
      authorizationEndpoint: 'https://dial.example.test/oauth',
      scopes: [],
    };
    const refetch = vi.fn(async () => {
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect,
        refetch,
      });
    });
    useOfflineCredentialsGateMock.mockReturnValue({
      status: 'hidden',
      connect: undefined,
      refetch,
    });
    startScheduledTaskMock.mockResolvedValue({
      id: 'run_started',
      status: 'InProgress',
      startTime: '2026-09-30T09:00:00Z',
    });
    getScheduledTaskRunMock.mockResolvedValue({
      id: 'run_started',
      status: 'Error',
      resultStage: 'credentials',
      startTime: '2026-09-30T09:00:00Z',
    });
    renderDetailPage();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );
    expect(
      await screen.findByRole(
        'button',
        { name: 'buttons.logIn' },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(startScheduledTaskMock).toHaveBeenCalledTimes(1);
  });

  it('retains the accepted run and a scoped retry when initial History fails', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Task',
      trigger: {},
    });
    const refetch = vi.fn();
    useScheduledTaskRunsMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: new Error('History unavailable'),
      hasMore: false,
      refetch,
    });
    startScheduledTaskMock.mockResolvedValue({
      id: 'run_started',
      status: 'InProgress',
      startTime: '2026-09-30T09:00:00Z',
    });
    renderDetailPage();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );
    expect(await screen.findByText('runs:1')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'scheduledTasks.detail.historyError',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'scheduledTasks.list.retryLabel' }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('runs:1')).toBeTruthy();
  });

  it('offers offline-credentials recovery for a credentials-stage run without automatically starting another run', async () => {
    const refetchOfflineCredentials = vi.fn();
    const connect = {
      clientId: 'offline-client',
      authorizationEndpoint: 'https://dial.example.test/oauth',
      scopes: ['openid'],
    };
    useOfflineCredentialsGateMock.mockReturnValue({
      status: 'available',
      connect,
      refetch: refetchOfflineCredentials,
    });
    loginOfflineCredentialsMock.mockResolvedValue({ type: 'success' });
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    useScheduledTaskRunsMock.mockReturnValue({
      items: [
        {
          id: 'run_credentials',
          status: 'Error',
          resultStage: 'credentials',
          startTime: '2026-09-30T09:00:00Z',
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

    expect(
      await screen.findByText('scheduledTasks.detail.runCredentialsRequired'),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.logIn' }),
    );

    await waitFor(() =>
      expect(loginOfflineCredentialsMock).toHaveBeenCalledWith(
        connect,
        refetchOfflineCredentials,
      ),
    );
    expect(startScheduledTaskMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'scheduledTasks.offlineCredentialsBanner.successAnnouncement',
      ),
    ).toBeTruthy();
  });

  it.each([
    ['popup-blocked', 'retry-popup-blocked'],
    ['cancelled', 'retry-cancelled'],
    ['failure', 'retry-failed'],
  ])(
    'keeps credential recovery user-driven after a %s login outcome',
    async (outcome, expectedState) => {
      useOfflineCredentialsGateMock.mockReturnValue({
        status: 'available',
        connect: {
          clientId: 'offline-client',
          authorizationEndpoint: 'https://dial.example.test/oauth',
          scopes: [],
        },
        refetch: vi.fn(),
      });
      loginOfflineCredentialsMock.mockResolvedValue({ type: outcome });
      getScheduledTaskMock.mockResolvedValue({
        id: 'sched_123',
        displayName: 'Daily summary',
        trigger: {},
      });
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_credentials',
            status: 'Error',
            resultStage: 'credentials',
            startTime: '2026-09-30T09:00:00Z',
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

      await userEvent.click(
        await screen.findByRole('button', { name: 'buttons.logIn' }),
      );

      expect(
        await screen.findByRole('button', { name: 'buttons.retry' }),
      ).toBeTruthy();
      expect(loginOfflineCredentialsMock).toHaveBeenCalledOnce();
      expect(startScheduledTaskMock).not.toHaveBeenCalled();
      expect(expectedState).toMatch(/^retry-/);
    },
  );

  it('reports a deleted start response with its trace and disables Start now until the task is reloaded', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    startScheduledTaskMock.mockRejectedValue(new Error('deleted'));
    getApiErrorDetailsMock.mockResolvedValue({
      status: 409,
      traceId: 'trace-deleted-run',
    });
    renderDetailPage();

    const startButton = await screen.findByRole('button', {
      name: 'scheduledTasks.detail.startNow',
    });
    await userEvent.click(startButton);

    await waitFor(() =>
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'scheduledTasks.detail.startDeleted',
          requestId: 'trace-deleted-run',
        }),
      ),
    );
    expect(startButton).toHaveProperty('disabled', true);
    await userEvent.click(startButton);
    expect(startScheduledTaskMock).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'admin consent is revoked',
      {
        status: 403,
        code: 'scheduledTaskAdminConsentRequired',
        traceId: 'trace-consent',
      },
      'toolsetSignin.adminConsentRequired',
    ],
    [
      'DIAL Scheduler supplies an upstream reason',
      {
        status: 502,
        upstreamMessage: 'Schedule is locked by another operation',
        traceId: 'trace-upstream',
      },
      'Schedule is locked by another operation',
    ],
  ])('reports start failures when %s', async (_name, details, message) => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    });
    startScheduledTaskMock.mockRejectedValue(new Error('start failed'));
    getApiErrorDetailsMock.mockResolvedValue(details);
    renderDetailPage();

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'scheduledTasks.detail.startNow',
      }),
    );

    await waitFor(() =>
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({ message, requestId: details.traceId }),
      ),
    );
  });

  it("passes the loaded task's nextRunTime to useScheduledTaskRuns once resolved, undefined beforehand", async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
      nextRunTime: '2026-07-31T09:00:00.000Z',
    });
    renderDetailPage();

    expect(useScheduledTaskRunsMock).toHaveBeenCalledWith(
      'sched_123',
      true,
      undefined,
    );

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();

    expect(useScheduledTaskRunsMock).toHaveBeenCalledWith(
      'sched_123',
      true,
      '2026-07-31T09:00:00.000Z',
    );
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

    it('re-enables the switch after a pause settles when rendered under StrictMode', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      pauseScheduledTaskMock.mockResolvedValue({
        ...activeTask,
        isActive: false,
        nextRunTime: null,
      });

      /*
       * Regression: StrictMode's simulated remount (mount → cleanup → mount,
       * local dev) used to leave the page's mount-tracking permanently
       * "unmounted", so every pause/resume resolution resolved as stale —
       * the switch never re-enabled and the updated task never landed.
       */
      render(
        <StrictMode>
          <MemoryRouter initialEntries={['/scheduled-tasks/sched_123']}>
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
              <Route
                path="/conversations/*"
                element={<ConversationTargetStub />}
              />
            </Routes>
          </MemoryRouter>
        </StrictMode>,
      );

      const switchEl = await screen.findByRole('switch');
      await userEvent.click(switchEl);

      expect(pauseScheduledTaskMock).toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('disabled', false),
      );
      expect(screen.getByRole('switch')).toHaveProperty('checked', false);
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

    it('reverts the switch and asks to contact an administrator when resume is blocked by revoked consent', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue({
        ...activeTask,
        isActive: false,
        nextRunTime: undefined,
      });
      resumeScheduledTaskMock.mockRejectedValue(new Error('forbidden'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 403,
        code: 'scheduledTaskAdminConsentRequired',
        traceId: 'trace-consent',
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(screen.getByRole('switch')).toHaveProperty('checked', false),
      );
      expect(showNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'error',
          message: 'toolsetSignin.adminConsentRequired',
          requestId: 'trace-consent',
        }),
      );
    });

    it("shows DIAL Scheduler's reason when a pause fails with one", async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(activeTask);
      pauseScheduledTaskMock.mockRejectedValue(new Error('upstream error'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 502,
        upstreamMessage: 'Schedule is locked by another operation',
      });
      renderDetailPage();

      await userEvent.click(await screen.findByRole('switch'));

      await waitFor(() =>
        expect(showNotificationMock).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'error',
            message: 'Schedule is locked by another operation',
          }),
        ),
      );
      expect(screen.getByRole('switch')).toHaveProperty('checked', true);
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

    it("a generic failure shows DIAL Scheduler's reason when it supplies one", async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockRejectedValue(new Error('rejected'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 400,
        upstreamMessage: 'Schedule is running; retry later',
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
            message: 'Schedule is running; retry later',
          }),
        ),
      );
      expect(screen.getByText('isDeleting:false')).toBeTruthy();
    });

    it('a 502 keeps the localized retryable message even when Scheduler supplies a reason', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      deleteScheduledTaskMock.mockRejectedValue(new Error('upstream'));
      getApiErrorDetailsMock.mockResolvedValue({
        status: 502,
        upstreamMessage: 'Could not unregister job',
      });
      renderDetailPage();

      const dialog = await openDeleteDialog();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'buttons.delete' }),
      );

      await waitFor(() =>
        expect(showNotificationMock).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'scheduledTasks.detail.deleteRetryableError',
          }),
        ),
      );
    });
  });

  describe('History run navigation', () => {
    const loadedTask = {
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: {},
    };

    it('navigates to the conversation route when a run with a conversationId is activated', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_1',
            status: 'Success',
            startTime: '2026-07-24T09:00:00.000Z',
            conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
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

      await userEvent.click(
        await screen.findByRole('button', { name: /^run:run_1:/ }),
      );

      expect(await screen.findByText('conversation view')).toBeTruthy();
    });

    it('does not navigate when a run has no conversationId', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_1',
            status: 'Success',
            startTime: '2026-07-24T09:00:00.000Z',
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

      await userEvent.click(
        await screen.findByRole('button', { name: /^run:run_1:/ }),
      );

      expect(screen.queryByText('conversation view')).toBeNull();
      expect(screen.getByText('displayName:Daily summary')).toBeTruthy();
    });

    it('resolves isUnread true when the matched conversation carries a differently-prefixed id', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      useConversationsMock.mockReturnValue({
        conversations: [
          { id: 'bucket/.scheduler/sched_123/run_1', isUnread: true },
        ],
      });
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_1',
            status: 'Success',
            startTime: '2026-07-24T09:00:00.000Z',
            conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
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

      expect(
        await screen.findByRole('button', { name: 'run:run_1:unread' }),
      ).toBeTruthy();
    });

    it('resolves isUnread false when no conversation matches the run', async () => {
      useFeatureFlagMock.mockReturnValue(true);
      getScheduledTaskMock.mockResolvedValue(loadedTask);
      useConversationsMock.mockReturnValue({
        conversations: [{ id: 'bucket/other-conversation', isUnread: true }],
      });
      useScheduledTaskRunsMock.mockReturnValue({
        items: [
          {
            id: 'run_1',
            status: 'Success',
            startTime: '2026-07-24T09:00:00.000Z',
            conversationId: 'conversations/bucket/.scheduler/sched_123/run_1',
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

      expect(
        await screen.findByRole('button', { name: 'run:run_1:read' }),
      ).toBeTruthy();
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

describe('ScheduledTaskDetailPage — completed state', () => {
  it('renders the completed label and hides the active switch for a finished one-time task', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'One-time report',
      trigger: { date: '2020-01-01T00:00:00.000Z' },
      triggerType: 'date',
      isActive: false,
      isCompleted: true,
      nextRunTime: null,
    });
    renderDetailPage();

    expect(
      await screen.findByText(
        'completedLabel:scheduledTasks.card.completedBadgeLabel',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/^disabledReason:/)).toBeNull();

    expect(pauseScheduledTaskMock).not.toHaveBeenCalled();
    expect(resumeScheduledTaskMock).not.toHaveBeenCalled();
  });

  it('hides the active switch and shows the completed label for a recurring schedule whose activity window has ended', async () => {
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
      isCompleted: true,
      nextRunTime: undefined,
    });
    renderDetailPage();

    expect(
      await screen.findByText(
        'completedLabel:scheduledTasks.card.completedBadgeLabel',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/^disabledReason:/)).toBeNull();
  });

  it('keeps the switch disabled with a reason when the completed signal is missing but the fields show exhaustion', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'One-time report',
      trigger: { date: '2020-01-01T00:00:00.000Z' },
      triggerType: 'date',
      isActive: false,
      nextRunTime: null,
    });
    renderDetailPage();

    expect(
      await screen.findByText(
        'disabledReason:scheduledTasks.detail.activeDisabledReasonCompleted',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('switch')).toHaveProperty('disabled', true);
    expect(screen.queryByText(/^completedLabel:/)).toBeNull();
  });

  it('renders no completed label for a task that has not completed', async () => {
    useFeatureFlagMock.mockReturnValue(true);
    getScheduledTaskMock.mockResolvedValue({
      id: 'sched_123',
      displayName: 'Daily summary',
      trigger: { cron: { fields: { hour: '9', minute: '0' } } },
      triggerType: 'cron',
      isActive: true,
      isCompleted: false,
      nextRunTime: '2030-01-01T09:00:00.000Z',
    });
    renderDetailPage();

    expect(await screen.findByText('displayName:Daily summary')).toBeTruthy();
    expect(screen.queryByText(/^completedLabel:/)).toBeNull();
    expect(screen.queryByText(/^disabledReason:/)).toBeNull();
  });
});
