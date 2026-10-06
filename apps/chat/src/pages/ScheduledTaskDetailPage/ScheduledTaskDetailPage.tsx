import {
  ScheduledTaskRunDtoStatusEnum,
  type ScheduledTaskDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '@epam/ai-dial-chat-hooks';
import {
  ScheduledTaskDetailView,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import { GhostButton } from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import ScheduledTaskDeleteModal from '../../components/ScheduledTaskDeleteModal/ScheduledTaskDeleteModal';
import ScheduledTasksLoginBanner, {
  ScheduledTasksLoginBannerState,
} from '../../components/ScheduledTasksLoginBanner/ScheduledTasksLoginBanner';
import {
  getConversationRoute,
  getScheduledTaskEditRoute,
} from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../hooks/offlineCredentials/useOfflineCredentialsGate';
import {
  OfflineCredentialsLoginOutcomeType,
  useOfflineCredentialsLogin,
} from '../../hooks/offlineCredentials/useOfflineCredentialsLogin';
import { useScheduledTaskRuns } from '../../hooks/scheduled-tasks/useScheduledTaskRuns';
import { useScheduledTaskSkillDisplayNames } from '../../hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames';
import {
  mergeScheduledTaskRuns,
  ScheduledTaskRunStatusFeedback,
  useStartScheduledTask,
} from '../../hooks/scheduled-tasks/useStartScheduledTask';
import { useStaleGuard } from '../../hooks/useStaleGuard';
import {
  deleteScheduledTask,
  getScheduledTask,
  pauseScheduledTask,
  resumeScheduledTask,
} from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { resolveLocalizedText } from '../../utils/locale';
import {
  buildScheduleLabel,
  getDeleteErrorMessageKey,
  resolveScheduledTaskErrorMessage,
} from '../../utils/map-scheduled-task-dto';
import { mapScheduledTaskRunDtosToItems } from '../../utils/map-scheduled-task-run-dto';
import NotFoundPage from '../NotFound/NotFound';

const resolveCredentialsBannerState = ({
  isCredentialsRequired,
  isLoggingIn,
  retryState,
  status,
}: {
  isCredentialsRequired: boolean;
  isLoggingIn: boolean;
  retryState: ScheduledTasksLoginBannerState | undefined;
  status: OfflineCredentialsGateStatus;
}): ScheduledTasksLoginBannerState | undefined => {
  if (!isCredentialsRequired) return undefined;
  if (isLoggingIn) return ScheduledTasksLoginBannerState.LoginInProgress;
  if (retryState) return retryState;
  if (
    status === OfflineCredentialsGateStatus.Available ||
    status === OfflineCredentialsGateStatus.Unavailable
  ) {
    return ScheduledTasksLoginBannerState.Shown;
  }
  return undefined;
};

const RUN_STATUS_LABEL_KEYS: Record<
  ScheduledTaskRunDtoStatusEnum,
  'success' | 'error' | 'inProgress' | 'missed'
> = {
  [ScheduledTaskRunDtoStatusEnum.Success]: 'success',
  [ScheduledTaskRunDtoStatusEnum.Error]: 'error',
  [ScheduledTaskRunDtoStatusEnum.InProgress]: 'inProgress',
  [ScheduledTaskRunDtoStatusEnum.Missed]: 'missed',
};

const ScheduledTaskDetailPage: FC = () => {
  const { t } = useTranslation();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams<{ scheduleId: string }>();
  const { items: deploymentItems } = useDeployments();
  const { language } = useLanguage();
  const { conversations, refreshConversations } = useConversations();

  const [task, setTask] = useState<ScheduledTaskDto | null>(null);
  const skillDisplayNames = useScheduledTaskSkillDisplayNames(task?.skillUrls);
  const [isTaskLoading, setIsTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState<Error | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [taskFetchToken, setTaskFetchToken] = useState(0);
  const [isActiveUpdating, setIsActiveUpdating] = useState(false);
  const [activeStatusAnnouncement, setActiveStatusAnnouncement] = useState('');
  const [startStatusAnnouncement, setStartStatusAnnouncement] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartRejectedAsDeleted, setIsStartRejectedAsDeleted] =
    useState(false);
  const [credentialsRetryState, setCredentialsRetryState] = useState<
    ScheduledTasksLoginBannerState | undefined
  >(undefined);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [credentialsStatusAnnouncement, setCredentialsStatusAnnouncement] =
    useState('');
  /*
   * Supersession guard for pause/resume: a check goes stale when the page
   * unmounts, a newer toggle begins, or the user navigates to a different
   * schedule (this page component stays mounted across scheduleId changes).
   */
  const beginActiveChangeGuard = useStaleGuard(scheduleId);
  const beginStartGuard = useStaleGuard(`${scheduleId}:${isEnabled}`);
  const startFeedbackPending = useRef(false);

  useEffect(() => {
    startFeedbackPending.current = false;
  }, [scheduleId, isEnabled]);

  const {
    items: runDtos,
    isLoading: runsIsLoading,
    isLoadingMore: runsIsLoadingMore,
    error: runsError,
    loadMoreError: runsLoadMoreError,
    retryLoadMore: retryRunsLoadMore,
    hasMore: runsHasMore,
    loadMore: onRunsLoadMore,
    refetch: refetchRuns,
  } = useScheduledTaskRuns(
    scheduleId,
    isEnabled && Boolean(scheduleId),
    task?.nextRunTime,
  );

  const isTaskDeleted = task?.isDeleted === true;
  const {
    status: credentialsStatus,
    connect: offlineCredentialsConnect,
    refetch: refetchOfflineCredentials,
  } = useOfflineCredentialsGate();
  const { login: loginOfflineCredentials } = useOfflineCredentialsLogin();
  const {
    acceptedRuns,
    isStarting,
    isRefreshingStatus,
    refreshStatus,
    statusFeedback,
    start: startTask,
    terminalRun,
  } = useStartScheduledTask({
    scheduleId,
    enabled: isEnabled,
    canStart:
      Boolean(task) &&
      !isTaskDeleted &&
      !isTaskLoading &&
      !isDeleting &&
      !isActiveUpdating &&
      !isStartRejectedAsDeleted,
    loadedRuns: runDtos,
  });

  useEffect(() => {
    if (!isEnabled || !scheduleId) {
      setIsTaskLoading(false);
      return;
    }

    /*
     * A scheduleId change retires any in-flight pause/resume request: its
     * stale guard resolves as stale, which skips the `finally` reset of
     * `isActiveUpdating` — reset it here so the Active switch never stays
     * disabled into the next task's view.
     */
    setIsActiveUpdating(false);

    const cancelled = { value: false };

    const load = async () => {
      setIsTaskLoading(true);
      setTaskError(null);
      setIsNotFound(false);
      try {
        const result = await getScheduledTask(scheduleId);
        if (!cancelled.value) {
          setTask(result);
          setIsStartRejectedAsDeleted(result.isDeleted === true);
        }
      } catch (err) {
        if (!cancelled.value) {
          if (getApiErrorStatus(err) === 404) {
            setIsNotFound(true);
          } else {
            setTaskError(
              err instanceof Error
                ? err
                : new Error('Failed to load the scheduled task'),
            );
          }
        }
      } finally {
        if (!cancelled.value) {
          setIsTaskLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, [isEnabled, scheduleId, taskFetchToken]);

  const mergedRunDtos = useMemo(
    () => mergeScheduledTaskRuns(acceptedRuns, runDtos),
    [acceptedRuns, runDtos],
  );
  /* Fast status polling must also discover newly created chats, without
     refetching the full list on every unchanged InProgress response. */
  const acceptedConversationRuns = JSON.stringify(
    acceptedRuns
      .filter((run) => run.conversationId)
      .map(({ id, status, conversationId }) => [id, status, conversationId]),
  );
  useEffect(() => {
    if (isEnabled && acceptedConversationRuns !== '[]') {
      const runs = JSON.parse(acceptedConversationRuns) as [
        string,
        string,
        string,
      ][];
      void refreshConversations(
        runs.map(([, , conversationId]) => conversationId),
      );
    }
  }, [acceptedConversationRuns, isEnabled, refreshConversations]);

  const runStatusLabels = useMemo(
    () => ({
      success: t(ScheduledTasksI18nKeys.DetailStatusSuccess),
      error: t(ScheduledTasksI18nKeys.DetailStatusError),
      inProgress: t(ScheduledTasksI18nKeys.DetailStatusInProgress),
      missed: t(ScheduledTasksI18nKeys.DetailStatusMissed),
    }),
    [t],
  );
  const announcedTerminalRun = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!terminalRun) return;
    const announcementKey = `${terminalRun.id}:${terminalRun.status}`;
    if (announcedTerminalRun.current === announcementKey) return;

    announcedTerminalRun.current = announcementKey;
    setStartStatusAnnouncement(
      t(ScheduledTasksI18nKeys.DetailRunFinished, {
        status: runStatusLabels[RUN_STATUS_LABEL_KEYS[terminalRun.status]],
      }),
    );
  }, [runStatusLabels, t, terminalRun]);

  useEffect(() => {
    if (statusFeedback === ScheduledTaskRunStatusFeedback.Unavailable) {
      setStartStatusAnnouncement(
        t(ScheduledTasksI18nKeys.DetailRunStatusUnavailable),
      );
    }
    if (statusFeedback === ScheduledTaskRunStatusFeedback.Delayed) {
      setStartStatusAnnouncement(
        t(ScheduledTasksI18nKeys.DetailRunStatusDelayed),
      );
    }
  }, [statusFeedback, t]);

  const runStatusMessage =
    statusFeedback === ScheduledTaskRunStatusFeedback.Unavailable
      ? t(ScheduledTasksI18nKeys.DetailRunStatusUnavailable)
      : statusFeedback === ScheduledTaskRunStatusFeedback.Delayed
        ? t(ScheduledTasksI18nKeys.DetailRunStatusDelayed)
        : undefined;
  const runItems: ScheduledTaskRunItem[] = useMemo(
    () => mapScheduledTaskRunDtosToItems(mergedRunDtos, t, conversations),
    [mergedRunDtos, t, conversations],
  );
  const isCredentialsRequired = mergedRunDtos.some(
    (run) =>
      run.status === ScheduledTaskRunDtoStatusEnum.Error &&
      run.resultStage === 'credentials',
  );
  const credentialsRunId = mergedRunDtos.find(
    (run) =>
      run.status === ScheduledTaskRunDtoStatusEnum.Error &&
      run.resultStage === 'credentials',
  )?.id;
  const checkedCredentialsRun = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isEnabled || !credentialsRunId) return;
    const key = `${scheduleId}:${credentialsRunId}`;
    if (checkedCredentialsRun.current === key) return;
    checkedCredentialsRun.current = key;
    /* A run can discover revoked credentials after the route's initial check. */
    void refetchOfflineCredentials();
  }, [credentialsRunId, isEnabled, refetchOfflineCredentials, scheduleId]);
  const credentialsBannerState = resolveCredentialsBannerState({
    isCredentialsRequired,
    isLoggingIn,
    retryState: credentialsRetryState,
    status: credentialsStatus,
  });

  const handleRunClick = useCallback(
    (run: ScheduledTaskRunItem) => {
      if (!run.conversationId) return;
      navigate(getConversationRoute(run.conversationId));
    },
    [navigate],
  );

  const taskModel = task?.model;
  const modelLabel = useMemo(() => {
    if (!taskModel) return undefined;
    const deployment = deploymentItems.find((item) => item.id === taskModel);
    return deployment
      ? resolveLocalizedText(deployment.displayName, language) || taskModel
      : taskModel;
  }, [taskModel, deploymentItems, language]);

  const repeatsLabel = useMemo(
    () => (task ? buildScheduleLabel(task, t, language) : undefined),
    [task, t, language],
  );

  const cronWindow = task?.trigger.cron;
  const activeWindowLabel = useMemo(() => {
    if (!cronWindow?.startDate || !cronWindow?.endDate) return undefined;
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    });
    return t(ScheduledTasksI18nKeys.DetailActiveWindowValue, {
      startDate: dateFormatter.format(new Date(cronWindow.startDate)),
      endDate: dateFormatter.format(new Date(cronWindow.endDate)),
    });
  }, [cronWindow, t]);

  const taskNextRunTime = task?.nextRunTime;
  const nextRunLabel = useMemo(() => {
    if (!taskNextRunTime) return undefined;
    let formatted = taskNextRunTime;
    try {
      formatted = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(taskNextRunTime));
    } catch {
      // Keep the raw ISO string if the date can't be formatted.
    }
    return t(ScheduledTasksI18nKeys.DetailNextRunLabel, { value: formatted });
  }, [taskNextRunTime, t]);

  const labels = useMemo(
    () => ({
      backAriaLabel: t(ScheduledTasksI18nKeys.CreateBackButtonLabel),
      editButtonLabel: t(ScheduledTasksI18nKeys.CardEditActionLabel),
      deleteButtonLabel: t(ButtonsI18nKeys.Delete),
      deletedStateLabel: t(ScheduledTasksI18nKeys.DetailDeletedStateLabel),
      errorLabel: t(ScheduledTasksI18nKeys.DetailErrorLabel),
      detailsTitle: t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle),
      descriptionLabel: t(ScheduledTasksI18nKeys.CreateDescriptionLabel),
      modelLabel: t(ScheduledTasksI18nKeys.CreateModelOrAgentLabel),
      repeatsLabel: t(ScheduledTasksI18nKeys.DetailRepeatsLabel),
      activeWindowLabel: t(ScheduledTasksI18nKeys.DetailActiveWindowLabel),
      configurationTitle: t(
        ScheduledTasksI18nKeys.CreateConfigurationSectionTitle,
      ),
      instructionsLabel: t(ScheduledTasksI18nKeys.CreateInstructionsLabel),
      skillLabel: t(ScheduledTasksI18nKeys.CreateSkillLabel),
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      historyTitle: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
      historyEmptyLabel: t(ScheduledTasksI18nKeys.DetailHistoryEmptyLabel),
      historyErrorLabel: t(ScheduledTasksI18nKeys.DetailHistoryErrorLabel),
      historyRetryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      historyLoadingMoreLabel: t(
        ScheduledTasksI18nKeys.DetailHistoryLoadingMoreLabel,
      ),
      historyShowMoreLabel: t(ButtonsI18nKeys.ShowMore),
      runStatusLabels,
      activeStatusLabel: t(ScheduledTasksI18nKeys.DetailActiveStatusLabel),
      completedFieldLabel: t(ScheduledTasksI18nKeys.DetailCompletedFieldLabel),
      activeStatusAnnouncement,
      startNowButtonLabel: t(ScheduledTasksI18nKeys.DetailStartNow),
      startingLabel: t(ScheduledTasksI18nKeys.DetailStarting),
      startNowBusyLabel: t(ScheduledTasksI18nKeys.DetailStartBusy),
      startStatusAnnouncement,
      unreadIndicatorLabel: t(ConversationPanelI18nKeys.UnreadIndicatorLabel),
      codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
      codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
      codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
      tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
      mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
    }),
    [t, activeStatusAnnouncement, runStatusLabels, startStatusAnnouncement],
  );

  const hasInProgressRun = mergedRunDtos.some(
    (run) => run.status === ScheduledTaskRunDtoStatusEnum.InProgress,
  );

  const handleBack = () => {
    navigate(ROUTES.ScheduledTasks);
  };

  const handleEdit = useCallback(() => {
    navigate(getScheduledTaskEditRoute(scheduleId));
  }, [navigate, scheduleId]);

  const handleRetry = () => {
    setTaskFetchToken((token) => token + 1);
  };

  /*
   * A completed task can never produce another run, so its Active switch is
   * hidden entirely (the completed line in the details summary carries the
   * state) — no dead-end control is offered.
   */
  const isTaskCompleted = task?.isCompleted === true;

  /*
   * Fallback for the shapes where the BFF's `isCompleted` enrichment degraded
   * to `undefined` (a failed runs check) or the run is still in flight: a
   * one-time (`date`) schedule with no next run has already fired, and a
   * recurring (`cron`) schedule whose activity window `endDate` has already
   * passed can't produce a future run either. Completed tasks never reach
   * this — their switch is hidden above — so this only disables the switch
   * that still renders, keeping the state visible without offering a
   * dead-end toggle.
   */
  const cronWindowEndDate = task?.trigger.cron?.endDate;
  const isActiveDisabled =
    (task?.triggerType === 'date' && task?.nextRunTime == null) ||
    (task?.triggerType === 'cron' &&
      cronWindowEndDate != null &&
      new Date(cronWindowEndDate).getTime() <= Date.now());

  /*
   * The disabled switch's explanatory text differs per case: a fired one-time
   * schedule already ran, while a recurring schedule's activity window has
   * closed — the user sees why the toggle is dead rather than a bare disabled
   * control. Only computed while the switch renders; a completed task hides
   * the switch, so it gets no reason.
   */
  let activeDisabledReason: string | undefined;
  if (isActiveDisabled && !isTaskCompleted) {
    activeDisabledReason =
      task?.triggerType === 'date'
        ? t(ScheduledTasksI18nKeys.DetailActiveDisabledReasonCompleted)
        : t(ScheduledTasksI18nKeys.DetailActiveDisabledReasonExpired);
  }

  const completedLabel = isTaskCompleted
    ? t(ScheduledTasksI18nKeys.CardCompletedBadgeLabel)
    : undefined;

  const handleActiveChange = useCallback(
    async (nextActive: boolean) => {
      const isStale = beginActiveChangeGuard();

      setTask((current) =>
        current ? { ...current, isActive: nextActive } : current,
      );
      setIsActiveUpdating(true);

      try {
        const updated = nextActive
          ? await resumeScheduledTask(scheduleId)
          : await pauseScheduledTask(scheduleId);
        if (isStale()) return;

        setTask(updated);
        setActiveStatusAnnouncement(
          t(
            nextActive
              ? ScheduledTasksI18nKeys.DetailResumeSuccess
              : ScheduledTasksI18nKeys.DetailPauseSuccess,
          ),
        );
        showSuccessNotification({
          message: t(
            nextActive
              ? ScheduledTasksI18nKeys.DetailResumeSuccess
              : ScheduledTasksI18nKeys.DetailPauseSuccess,
          ),
        });
      } catch (err) {
        if (isStale()) return;

        setTask((current) =>
          current ? { ...current, isActive: !nextActive } : current,
        );
        const details = await getApiErrorDetails(err);
        showErrorNotification({
          message: resolveScheduledTaskErrorMessage(
            details,
            ScheduledTasksI18nKeys.DetailActiveStatusUpdateError,
            t,
          ),
          requestId: details.traceId,
        });
      } finally {
        if (!isStale()) {
          setIsActiveUpdating(false);
        }
      }
    },
    [
      scheduleId,
      t,
      showSuccessNotification,
      showErrorNotification,
      beginActiveChangeGuard,
    ],
  );

  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogClose = useCallback(() => {
    if (isDeleting) return;
    setIsDeleteDialogOpen(false);
  }, [isDeleting]);

  const handleDeleteConfirm = useCallback(async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteScheduledTask(scheduleId);
      setIsDeleteDialogOpen(false);
      showSuccessNotification({
        message: t(ScheduledTasksI18nKeys.DetailDeleteSuccess),
      });
      navigate(ROUTES.ScheduledTasks);
    } catch (err) {
      const { status, traceId, upstreamMessage } =
        await getApiErrorDetails(err);
      const messageKey = getDeleteErrorMessageKey(status);
      showErrorNotification({
        /* 404/409/502 keep their actionable localized messages; only the generic branch shows Scheduler's reason. */
        message:
          messageKey === ScheduledTasksI18nKeys.DetailDeleteGenericError
            ? resolveScheduledTaskErrorMessage(
                { upstreamMessage },
                messageKey,
                t,
              )
            : t(messageKey),
        requestId: traceId,
      });
      setIsDeleting(false);
    }
  }, [
    scheduleId,
    t,
    showSuccessNotification,
    showErrorNotification,
    navigate,
    isDeleting,
  ]);

  const handleStartNow = useCallback(async () => {
    if (startFeedbackPending.current) return;
    startFeedbackPending.current = true;
    const isStale = beginStartGuard();
    try {
      const acceptedRun = await startTask();
      if (!acceptedRun || isStale()) return;

      const message = t(ScheduledTasksI18nKeys.DetailStartAccepted);
      setStartStatusAnnouncement(message);
      showSuccessNotification({ message });
    } catch (err) {
      if (isStale()) return;
      const details = await getApiErrorDetails(err);
      if (isStale()) return;
      if (details.status === 409) {
        setIsStartRejectedAsDeleted(true);
      }
      showErrorNotification({
        message:
          details.status === 404
            ? t(ScheduledTasksI18nKeys.DetailStartNotFound)
            : details.status === 409
              ? t(ScheduledTasksI18nKeys.DetailStartDeleted)
              : resolveScheduledTaskErrorMessage(
                  details,
                  ScheduledTasksI18nKeys.DetailStartError,
                  t,
                ),
        requestId: details.traceId,
      });
    } finally {
      if (!isStale()) startFeedbackPending.current = false;
    }
  }, [
    beginStartGuard,
    showErrorNotification,
    showSuccessNotification,
    startTask,
    t,
  ]);

  const handleOfflineCredentialsLogin = useCallback(() => {
    if (!offlineCredentialsConnect) return;
    setIsLoggingIn(true);
    setCredentialsRetryState(undefined);
    setCredentialsStatusAnnouncement('');

    const run = async (): Promise<void> => {
      const outcome = await loginOfflineCredentials(
        offlineCredentialsConnect,
        refetchOfflineCredentials,
      );
      setIsLoggingIn(false);

      switch (outcome.type) {
        case OfflineCredentialsLoginOutcomeType.Success:
          setCredentialsStatusAnnouncement(
            t(
              ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
            ),
          );
          setCredentialsRetryState(undefined);
          break;
        case OfflineCredentialsLoginOutcomeType.PopupBlocked:
          setCredentialsRetryState(
            ScheduledTasksLoginBannerState.RetryPopupBlocked,
          );
          break;
        case OfflineCredentialsLoginOutcomeType.Cancelled:
          setCredentialsRetryState(
            ScheduledTasksLoginBannerState.RetryCancelled,
          );
          break;
        case OfflineCredentialsLoginOutcomeType.TimedOut:
          setCredentialsRetryState(ScheduledTasksLoginBannerState.RetryTimeout);
          break;
        case OfflineCredentialsLoginOutcomeType.Failure:
        default:
          setCredentialsRetryState(ScheduledTasksLoginBannerState.RetryFailed);
          break;
      }
    };
    void run();
  }, [
    loginOfflineCredentials,
    offlineCredentialsConnect,
    refetchOfflineCredentials,
    t,
  ]);

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return (
    <>
      <ScheduledTaskDetailView
        labels={labels}
        onBack={handleBack}
        onEdit={task && !isTaskDeleted ? handleEdit : undefined}
        onStartNow={task && !isTaskDeleted ? handleStartNow : undefined}
        onDelete={task && !isTaskDeleted ? handleDeleteClick : undefined}
        isDeleting={isDeleting}
        isStarting={isStarting}
        isStartNowDisabled={
          isDeleting ||
          isActiveUpdating ||
          isTaskLoading ||
          isStartRejectedAsDeleted
        }
        isStartNowBusy={hasInProgressRun}
        isDeleted={isTaskDeleted}
        isCompleted={isTaskCompleted}
        isActive={isTaskDeleted ? undefined : task?.isActive}
        isActiveUpdating={isActiveUpdating}
        isActiveDisabled={isActiveDisabled}
        activeDisabledReason={activeDisabledReason}
        onActiveChange={isTaskDeleted ? undefined : handleActiveChange}
        displayName={task?.displayName ?? ''}
        isLoading={isTaskLoading}
        error={taskError}
        onRetry={handleRetry}
        description={task?.description}
        modelLabel={modelLabel}
        repeatsLabel={repeatsLabel}
        activeWindowLabel={activeWindowLabel}
        completedLabel={completedLabel}
        nextRunLabel={nextRunLabel}
        instructionsMarkdown={task?.prompt}
        skillDisplayNames={skillDisplayNames}
        runs={runItems}
        runsIsLoading={runsIsLoading && mergedRunDtos.length === 0}
        runsIsLoadingMore={runsIsLoadingMore}
        runsError={mergedRunDtos.length === 0 ? runsError : null}
        onRunsRetry={refetchRuns}
        runsLoadMoreError={runsLoadMoreError}
        onRunsRetryLoadMore={retryRunsLoadMore}
        runsHasMore={runsHasMore}
        onRunsLoadMore={onRunsLoadMore}
        onRunClick={handleRunClick}
      />
      {runsError && mergedRunDtos.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 px-4 py-2"
        >
          <span>{labels.historyErrorLabel}</span>
          <GhostButton
            label={labels.historyRetryLabel}
            onClick={refetchRuns}
            className="min-h-11"
          />
        </div>
      )}
      <ScheduledTasksLoginBanner
        state={credentialsBannerState}
        title={t(ScheduledTasksI18nKeys.OfflineCredentialsBannerTitle)}
        body={t(ScheduledTasksI18nKeys.DetailRunCredentialsRequired)}
        loginButtonLabel={t(ButtonsI18nKeys.LogIn)}
        retryButtonLabel={t(ButtonsI18nKeys.Retry)}
        loggingInLabel={t(
          ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel,
        )}
        popupBlockedMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
        )}
        cancelledMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
        )}
        timeoutMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
        )}
        failedMessage={t(
          ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
        )}
        liveAnnouncement={credentialsStatusAnnouncement}
        onLogIn={
          offlineCredentialsConnect ? handleOfflineCredentialsLogin : undefined
        }
      />
      {runStatusMessage && (
        <div>
          <span>{runStatusMessage}</span>
          {statusFeedback === ScheduledTaskRunStatusFeedback.Delayed && (
            <GhostButton
              label={t(ScheduledTasksI18nKeys.DetailRefreshRunStatus)}
              disabled={isRefreshingStatus}
              onClick={() => void refreshStatus()}
              className="min-h-11"
            />
          )}
        </div>
      )}
      <ScheduledTaskDeleteModal
        open={isDeleteDialogOpen}
        taskName={task?.displayName ?? ''}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteDialogClose}
      />
    </>
  );
};

export default memo(ScheduledTaskDetailPage);
