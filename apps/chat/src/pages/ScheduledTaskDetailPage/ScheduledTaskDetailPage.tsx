import {
  ScheduledTaskDetailView,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import type { ScheduledTaskDto } from '@epam/chat-api-client';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { getScheduledTaskEditRoute } from '../../constants/routes';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useScheduledTaskRuns } from '../../hooks/scheduled-tasks/useScheduledTaskRuns';
import { getApiErrorStatus } from '../../server-api/api-error';
import { getScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import { resolveLocalizedText } from '../../utils/locale';
import { buildScheduleLabel } from '../../utils/map-scheduled-task-dto';
import { mapScheduledTaskRunDtosToItems } from '../../utils/map-scheduled-task-run-dto';
import NotFoundPage from '../NotFound/NotFound';

const ScheduledTaskDetailPage: FC = () => {
  const { t } = useTranslation();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams<{ scheduleId: string }>();
  const { items: deploymentItems } = useDeployments();
  const { language } = useLanguage();

  const [task, setTask] = useState<ScheduledTaskDto | null>(null);
  const [isTaskLoading, setIsTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState<Error | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [taskFetchToken, setTaskFetchToken] = useState(0);

  const {
    items: runDtos,
    isLoading: runsIsLoading,
    isLoadingMore: runsIsLoadingMore,
    error: runsError,
    hasMore: runsHasMore,
    loadMore: onRunsLoadMore,
    refetch: refetchRuns,
  } = useScheduledTaskRuns(scheduleId, isEnabled && Boolean(scheduleId));

  useEffect(() => {
    if (!isEnabled || !scheduleId) {
      setIsTaskLoading(false);
      return;
    }

    const cancelled = { value: false };

    const load = async () => {
      setIsTaskLoading(true);
      setTaskError(null);
      setIsNotFound(false);
      try {
        const result = await getScheduledTask(scheduleId);
        if (!cancelled.value) {
          setTask(result);
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

  const runItems: ScheduledTaskRunItem[] = useMemo(
    () => mapScheduledTaskRunDtosToItems(runDtos, t),
    [runDtos, t],
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
    () => (task ? buildScheduleLabel(task, t) : undefined),
    [task, t],
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
      retryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      historyTitle: t(ScheduledTasksI18nKeys.DetailHistoryTitle),
      historyEmptyLabel: t(ScheduledTasksI18nKeys.DetailHistoryEmptyLabel),
      historyErrorLabel: t(ScheduledTasksI18nKeys.DetailHistoryErrorLabel),
      historyRetryLabel: t(ScheduledTasksI18nKeys.ListRetryLabel),
      historyLoadingMoreLabel: t(
        ScheduledTasksI18nKeys.DetailHistoryLoadingMoreLabel,
      ),
      runStatusLabels: {
        success: t(ScheduledTasksI18nKeys.DetailStatusSuccess),
        error: t(ScheduledTasksI18nKeys.DetailStatusError),
        inProgress: t(ScheduledTasksI18nKeys.DetailStatusInProgress),
        missed: t(ScheduledTasksI18nKeys.DetailStatusMissed),
      },
    }),
    [t],
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
    <ScheduledTaskDetailView
      labels={labels}
      onBack={handleBack}
      onEdit={task ? handleEdit : undefined}
      displayName={task?.displayName ?? ''}
      isLoading={isTaskLoading}
      error={taskError}
      onRetry={handleRetry}
      description={task?.description}
      modelLabel={modelLabel}
      repeatsLabel={repeatsLabel}
      activeWindowLabel={activeWindowLabel}
      nextRunLabel={nextRunLabel}
      instructionsMarkdown={task?.prompt}
      runs={runItems}
      runsIsLoading={runsIsLoading}
      runsIsLoadingMore={runsIsLoadingMore}
      runsError={runsError}
      onRunsRetry={refetchRuns}
      runsHasMore={runsHasMore}
      onRunsLoadMore={onRunsLoadMore}
    />
  );
};

export default memo(ScheduledTaskDetailPage);
