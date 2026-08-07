import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
} from '@epam/ai-dial-scheduled-tasks';
import { GhostButton, NotificationVariant } from '@epam/ai-dial-ui-kit';
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
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../server-api/api-error';
import {
  getScheduledTask,
  updateScheduledTask,
} from '../../server-api/scheduled-tasks.api';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { validateScheduledTaskForm } from '../../utils/scheduled-task-form-validation';
import {
  mapFormValuesToUpdateBody,
  mapScheduledTaskDtoToFormValues,
} from '../../utils/scheduled-task-trigger';
import NotFoundPage from '../NotFound/NotFound';

const ScheduledTaskEditPage: FC = () => {
  const { t } = useTranslation();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams<{ scheduleId: string }>();
  const { items: deploymentItems } = useDeployments();
  const { showNotification } = useNotification();
  const { currentTheme } = useTheme();

  const markdownEditorTheme: 'light' | 'dark' =
    currentTheme === ThemeId.Dark ? 'dark' : 'light';

  const [task, setTask] = useState<ScheduledTaskDto | null>(null);
  const [isTaskLoading, setIsTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState<Error | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [taskFetchToken, setTaskFetchToken] = useState(0);

  const [values, setValues] = useState<ScheduledTaskCreateFormValues | null>(
    null,
  );
  const [errors, setErrors] = useState<ScheduledTaskCreateFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnUrl = useMemo(
    () => getScheduledTaskDetailRoute(scheduleId),
    [scheduleId],
  );

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
      setIsUnsupported(false);
      try {
        const result = await getScheduledTask(scheduleId);
        if (cancelled.value) return;

        const mapped = mapScheduledTaskDtoToFormValues(result);
        if (!mapped.ok) {
          setTask(result);
          setIsUnsupported(true);
          return;
        }
        setTask(result);
        setValues(mapped.values);
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

  const modelOptions = useMemo(
    () =>
      deploymentItems.map((item) => ({
        id: item.id,
        label: item.displayName,
      })),
    [deploymentItems],
  );

  const labels = useMemo(
    () => ({
      pageTitle: t(ScheduledTasksI18nKeys.EditPageTitle),
      backButtonLabel: t(ScheduledTasksI18nKeys.CreateBackButtonLabel),
      detailsSectionTitle: t(ScheduledTasksI18nKeys.CreateDetailsSectionTitle),
      detailsSectionSubtitle: t(
        ScheduledTasksI18nKeys.CreateDetailsSectionSubtitle,
      ),
      configurationSectionTitle: t(
        ScheduledTasksI18nKeys.CreateConfigurationSectionTitle,
      ),
      configurationSectionSubtitle: t(
        ScheduledTasksI18nKeys.CreateConfigurationSectionSubtitle,
      ),
      displayNameLabel: t(EditorI18nKeys.NameLabel),
      displayNameRequired: t(EditorI18nKeys.NameRequired),
      scheduleSectionLabel: t(
        ScheduledTasksI18nKeys.CreateScheduleSectionLabel,
      ),
      scheduleTypeOnceLabel: t(ScheduledTasksI18nKeys.CreateScheduleTypeOnce),
      scheduleTypeRecurringLabel: t(
        ScheduledTasksI18nKeys.CreateScheduleTypeRecurring,
      ),
      scheduleTypeAriaLabel: t(
        ScheduledTasksI18nKeys.CreateScheduleTypeAriaLabel,
      ),
      runAtLabel: t(ScheduledTasksI18nKeys.CreateRunAtLabel),
      frequencyLabel: t(ScheduledTasksI18nKeys.CreateFrequencyLabel),
      frequencyOptions: [
        {
          key: ScheduledTaskFrequency.Daily,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyDaily),
        },
        {
          key: ScheduledTaskFrequency.Weekly,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyWeekly),
        },
        {
          key: ScheduledTaskFrequency.Monthly,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyMonthly),
        },
      ],
      timeLabel: t(ScheduledTasksI18nKeys.CreateTimeLabel),
      dayOfWeekLabel: t(ScheduledTasksI18nKeys.CreateDayOfWeekLabel),
      dayOfMonthLabel: t(ScheduledTasksI18nKeys.CreateDayOfMonthLabel),
      startDateLabel: t(ScheduledTasksI18nKeys.CreateStartDateLabel),
      startDatePlaceholder: t(
        ScheduledTasksI18nKeys.CreateStartDatePlaceholder,
      ),
      endDateLabel: t(ScheduledTasksI18nKeys.CreateEndDateLabel),
      endDatePlaceholder: t(ScheduledTasksI18nKeys.CreateEndDatePlaceholder),
      modelOrAgentLabel: t(ScheduledTasksI18nKeys.CreateModelOrAgentLabel),
      modelPlaceholder: t(ScheduledTasksI18nKeys.CreateModelPlaceholder),
      descriptionLabel: t(ScheduledTasksI18nKeys.CreateDescriptionLabel),
      instructionsLabel: t(ScheduledTasksI18nKeys.CreateInstructionsLabel),
      cancelButtonLabel: t(ButtonsI18nKeys.Cancel),
      createButtonLabel: t(ButtonsI18nKeys.Save),
    }),
    [t],
  );

  const handleFieldChange = useCallback(
    <K extends keyof ScheduledTaskCreateFormValues>(
      field: K,
      value: ScheduledTaskCreateFormValues[K],
    ) => {
      setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
      setErrors((prev) => {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field as keyof ScheduledTaskCreateFormErrors];
        return next;
      });
    },
    [],
  );

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleBack = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleRetry = useCallback(() => {
    setTaskFetchToken((token) => token + 1);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!values) return;

    const nextErrors = validateScheduledTaskForm(values, t);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateScheduledTask(scheduleId, mapFormValuesToUpdateBody(values));
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ScheduledTasksI18nKeys.EditSuccessNotification),
      });
      navigate(returnUrl);
    } catch (error) {
      if (getApiErrorStatus(error) === 404) {
        setIsNotFound(true);
        setIsSubmitting(false);
        return;
      }
      const { traceId } = await getApiErrorDetails(error);
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ScheduledTasksI18nKeys.EditErrorNotification),
        requestId: traceId,
      });
      setIsSubmitting(false);
    }
  }, [values, showNotification, t, navigate, returnUrl, scheduleId]);

  const handleSubmitVoid = useCallback(
    () => void handleSubmit(),
    [handleSubmit],
  );

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  if (isNotFound) {
    return <NotFoundPage />;
  }

  if (isTaskLoading) {
    return <RouteFallback />;
  }

  if (taskError) {
    return (
      <div
        role="alert"
        className="flex size-full flex-col items-center justify-center gap-3"
      >
        <p>{t(ScheduledTasksI18nKeys.DetailErrorLabel)}</p>
        <GhostButton
          label={t(ScheduledTasksI18nKeys.ListRetryLabel)}
          onClick={handleRetry}
        />
      </div>
    );
  }

  if (isUnsupported || !values || !task) {
    return (
      <div
        role="alert"
        className="flex size-full flex-col items-center justify-center gap-3"
      >
        <p>{t(ScheduledTasksI18nKeys.EditUnsupportedTriggerMessage)}</p>
        <GhostButton
          label={t(ScheduledTasksI18nKeys.CreateBackButtonLabel)}
          onClick={handleBack}
        />
      </div>
    );
  }

  return (
    <ScheduledTaskCreateForm
      labels={labels}
      values={values}
      errors={errors}
      modelOptions={modelOptions}
      onFieldChange={handleFieldChange}
      onBack={handleBack}
      onCancel={handleCancel}
      onSubmit={handleSubmitVoid}
      isSubmitting={isSubmitting}
      markdownEditorTheme={markdownEditorTheme}
    />
  );
};

export default memo(ScheduledTaskEditPage);
