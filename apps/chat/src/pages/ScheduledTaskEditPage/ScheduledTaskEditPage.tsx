import {
  TextRefinementPurpose,
  ScheduledTaskErrorCode,
} from '@epam/ai-dial-chat-api-client';
import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  getApiErrorStatus,
  mapScheduledTaskDtoToFormValues,
} from '@epam/ai-dial-chat-hooks';
import { prepareScheduledTaskUpdateBody } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
} from '@epam/ai-dial-scheduled-tasks';
import { EditorThemes, GhostButton } from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import DeploymentSelectorFieldTrigger from '../../components/DeploymentSelector/DeploymentSelectorFieldTrigger';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import ScheduledTaskSkillField from '../../components/ScheduledTaskSkillField/ScheduledTaskSkillField';
import { getScheduledTaskDetailRoute } from '../../constants/routes';
import {
  ScheduledTasksI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useScheduledTaskFormLabels } from '../../hooks/scheduled-tasks/useScheduledTaskFormLabels';
import { useScheduledTaskSkillSupport } from '../../hooks/scheduled-tasks/useScheduledTaskSkillSupport';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import {
  getScheduledTask,
  updateScheduledTask,
} from '../../server-api/scheduled-tasks.api';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  mapScheduledTaskValidationErrors,
  mapScheduledTaskApiError,
} from '../../utils/scheduled-task-form-validation';
import NotFoundPage from '../NotFound/NotFound';

const ScheduledTaskEditPage: FC = () => {
  const { t } = useTranslation();
  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.ScheduledTaskDescription,
  );
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.ScheduledTaskInstructions,
  );

  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const isSkillSelectionEnabled = useFeatureFlag('skillUsageEnabled');
  const skillLabelId = useId();
  const skillErrorId = useId();
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams<{ scheduleId: string }>();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { currentTheme } = useTheme();
  const modelLabelId = useId();

  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

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
  const isSkillsSupported = useScheduledTaskSkillSupport(values?.modelId);
  /* A capability change invalidates a prior server rejection. Local validation
   * below continues to block a selected skill until support is confirmed. */
  useEffect(() => {
    setErrors((previous) =>
      previous.skillUrl ? { ...previous, skillUrl: undefined } : previous,
    );
  }, [isSkillsSupported]);
  const effectiveErrors = {
    ...errors,
    skillUrl: isSkillSelectionUnsupported(values?.skillUrl, isSkillsSupported)
      ? t(SkillSelectorI18nKeys.UnsupportedTooltipLabel)
      : errors.skillUrl,
  };

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
        setValues({ minute: '0', ...mapped.values });
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

  const labels = useScheduledTaskFormLabels('edit', isSkillSelectionEnabled);

  const handleFieldChange = useCallback(
    <K extends keyof ScheduledTaskCreateFormValues>(
      field: K,
      value: ScheduledTaskCreateFormValues[K],
    ) => {
      setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
      setErrors((prev) => {
        const next = { ...prev };
        if (field === 'modelId' || field === 'skillUrl') delete next.skillUrl;
        if (field === 'prompt' || field === 'skillUrl') delete next.prompt;
        delete next[field as keyof ScheduledTaskCreateFormErrors];
        return next;
      });
    },
    [],
  );

  const handleModelSelect = useCallback(
    (id: string) => handleFieldChange('modelId', id),
    [handleFieldChange],
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

    const prepared = prepareScheduledTaskUpdateBody(values, {
      now: new Date(),
      isSkillsSupported,
    });
    if (!prepared.ok) {
      setErrors(mapScheduledTaskValidationErrors(prepared.errors, t));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateScheduledTask(scheduleId, prepared.body);
      showSuccessNotification({
        message: t(ScheduledTasksI18nKeys.EditSuccessNotification),
      });
      navigate(returnUrl);
    } catch (error) {
      const { traceId, code } = await getApiErrorDetails(error);
      const fieldErrors = mapScheduledTaskApiError(code, t);
      if (fieldErrors) {
        setErrors(fieldErrors);
        setIsSubmitting(false);
        return;
      }
      if (
        getApiErrorStatus(error) === 404 &&
        code !== ScheduledTaskErrorCode.ScheduledTaskDeploymentUnavailable
      ) {
        setIsNotFound(true);
        setIsSubmitting(false);
        return;
      }

      showErrorNotification({
        message: t(ScheduledTasksI18nKeys.EditErrorNotification),
        requestId: traceId,
      });
      setIsSubmitting(false);
    }
  }, [
    values,
    isSkillsSupported,
    showSuccessNotification,
    showErrorNotification,
    t,
    navigate,
    returnUrl,
    scheduleId,
  ]);

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
        <p>{t(ScheduledTasksI18nKeys.EditLoadErrorLabel)}</p>
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
        <p>{t(ScheduledTasksI18nKeys.EditInvalidScheduleLabel)}</p>
        <GhostButton
          label={t(ScheduledTasksI18nKeys.CreateBackButtonLabel)}
          onClick={handleBack}
        />
      </div>
    );
  }

  return (
    <ScheduledTaskCreateForm
      key={scheduleId}
      onRefineDescription={onRefineDescription}
      onRefineInstructions={onRefineInstructions}
      labels={labels}
      values={values}
      errors={effectiveErrors}
      skillLabelId={skillLabelId}
      skillErrorId={skillErrorId}
      skillSelector={
        isSkillSelectionEnabled ? (
          <ScheduledTaskSkillField
            value={values.skillUrl}
            onChange={(value) => handleFieldChange('skillUrl', value)}
            isSkillsSupported={isSkillsSupported}
            isDisabled={isSubmitting}
            isInvalid={Boolean(effectiveErrors.skillUrl)}
            labelledById={skillLabelId}
            describedById={effectiveErrors.skillUrl ? skillErrorId : undefined}
          />
        ) : undefined
      }
      modelSelector={
        <DeploymentSelectorFieldTrigger
          selectedId={values.modelId || null}
          onSelect={handleModelSelect}
          placeholder={t(ScheduledTasksI18nKeys.CreateModelPlaceholder)}
          labelledById={modelLabelId}
          isDisabled={isSubmitting}
          isInvalid={Boolean(errors.modelId)}
          panelClassName="desktop:min-w-[320px] [--ds-search-inline:12px]"
        />
      }
      modelLabelId={modelLabelId}
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
