import {
  TextRefinementPurpose,
  ScheduledTaskErrorCode,
} from '@epam/ai-dial-chat-api-client';
import type {
  ScheduledTaskDto,
  UpdateScheduledTaskBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorStatus,
  mapScheduledTaskDtoToFormValues,
  type ApiErrorDetails,
} from '@epam/ai-dial-chat-hooks';
import { prepareScheduledTaskUpdateBody } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
import {
  hasScheduledTaskFormChanges,
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
} from '@epam/ai-dial-scheduled-tasks';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EditorThemes,
  ElementSize,
  GhostButton,
  StateScreen,
} from '@epam/ai-dial-ui-kit';
import { IconAlertTriangle } from '@tabler/icons-react';
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
import { useScheduledTaskSubmit } from '../../hooks/scheduled-tasks/useScheduledTaskSubmit';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import {
  getScheduledTask,
  updateScheduledTask,
} from '../../server-api/scheduled-tasks.api';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  getLiveScheduledTaskFieldError,
  mapScheduledTaskValidationErrors,
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
  const navigate = useNavigate();
  const { scheduleId = '' } = useParams<{ scheduleId: string }>();
  const { showSuccessNotification } = useNotification();
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
  /* Values the form was hydrated with; unsaved changes are measured against
   * them, and none exist before the task has loaded. */
  const [initialValues, setInitialValues] =
    useState<ScheduledTaskCreateFormValues | null>(null);
  /* Activity-window boundaries the form was hydrated with. The past-date rule
   * exempts them, so an older task whose window already started stays editable
   * while a boundary changed into the past is still rejected. */
  const [originalWindowDates, setOriginalWindowDates] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  const [errors, setErrors] = useState<ScheduledTaskCreateFormErrors>({});
  const isSkillsSupported = useScheduledTaskSkillSupport(values?.modelId);
  /* A capability change invalidates a prior server rejection. Local validation
   * below continues to block a selected skill until support is confirmed. */
  useEffect(() => {
    setErrors((previous) =>
      previous.skillUrls ? { ...previous, skillUrls: undefined } : previous,
    );
  }, [isSkillsSupported]);
  const effectiveErrors = {
    ...errors,
    skillUrls: values?.skillUrls?.some((url) =>
      isSkillSelectionUnsupported(url, isSkillsSupported),
    )
      ? t(SkillSelectorI18nKeys.UnsupportedTooltipLabel)
      : errors.skillUrls,
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
        /* `everyWeeks` defaults like `minute`: a mapped Custom task always
         * carries it, and other cadences ignore it. */
        const hydratedValues = {
          minute: '0',
          everyWeeks: '1',
          ...mapped.values,
        };
        setValues(hydratedValues);
        setInitialValues(hydratedValues);
        setOriginalWindowDates({
          startDate: mapped.values.startDate,
          endDate: mapped.values.endDate,
        });
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

  const labels = useScheduledTaskFormLabels('edit');

  /* The page owns the unsaved-changes guard, so the form gets no
   * `initialValues` and shows no dialog of its own. */
  const { allowNextNavigation } = useBuilderLeaveGuard({
    isDirty:
      values != null &&
      initialValues != null &&
      hasScheduledTaskFormChanges(values, initialValues),
  });

  const handleFieldChange = useCallback(
    <K extends keyof ScheduledTaskCreateFormValues>(
      field: K,
      value: ScheduledTaskCreateFormValues[K],
    ) => {
      setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
      setErrors((prev) => {
        const next = { ...prev };
        if (field === 'modelId' || field === 'skillUrls') delete next.skillUrls;
        if (field === 'prompt' || field === 'skillUrls') delete next.prompt;
        delete next[field as keyof ScheduledTaskCreateFormErrors];
        const liveError = getLiveScheduledTaskFieldError(field, value, t);
        if (liveError) {
          next[field as keyof ScheduledTaskCreateFormErrors] = liveError;
        }
        return next;
      });
    },
    [t],
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

  /*
   * The whole submit orchestration (in-flight state, failure branches,
   * login-required toast, login-and-retry handshake) is the shared
   * `useScheduledTaskSubmit` flow — the handlers below supply this page's
   * own pieces, plus its not-found branch.
   */

  /** Prepares the update body from the current values; `null` while the form is not loaded yet or validation fails (field errors already applied). */
  const prepareUpdateBody = useCallback(() => {
    if (!values) return null;
    const prepared = prepareScheduledTaskUpdateBody(values, {
      now: new Date(),
      isSkillsSupported,
      originalStartDate: originalWindowDates.startDate,
      originalEndDate: originalWindowDates.endDate,
    });
    if (!prepared.ok) {
      setErrors(mapScheduledTaskValidationErrors(prepared.errors, t));
      return null;
    }
    return prepared.body;
  }, [values, originalWindowDates, isSkillsSupported, t]);

  /** Performs the update request for this task. */
  const saveTaskUpdate = useCallback(
    (body: UpdateScheduledTaskBodyDto) => updateScheduledTask(scheduleId, body),
    [scheduleId],
  );

  /** Runs the normal update success path (success toast + navigation back to the task detail). */
  const handleUpdateSuccess = useCallback(() => {
    showSuccessNotification({
      message: t(ScheduledTasksI18nKeys.EditSuccessNotification),
    });
    allowNextNavigation();
    navigate(returnUrl);
  }, [showSuccessNotification, t, allowNextNavigation, navigate, returnUrl]);

  /**
   * Marks a bare 404 as the task's not-found state and reports it fully
   * handled; a mapped deployment-unavailable code still takes the shared
   * branches.
   */
  const handleTaskNotFoundError = useCallback(
    (error: unknown, details: ApiErrorDetails) => {
      if (
        getApiErrorStatus(error) === 404 &&
        details.code !==
          ScheduledTaskErrorCode.ScheduledTaskDeploymentUnavailable
      ) {
        setIsNotFound(true);
        return true;
      }
      return false;
    },
    [],
  );

  const { isSubmitting, handleSubmit } = useScheduledTaskSubmit({
    prepare: prepareUpdateBody,
    save: saveTaskUpdate,
    onSuccess: handleUpdateSuccess,
    onFieldErrors: setErrors,
    errorKey: ScheduledTasksI18nKeys.EditErrorNotification,
    handleExtraError: handleTaskNotFoundError,
    /*
     * The page owns the login-and-retry action's presentation (the kit's own
     * retry-action doc example shape); the hook owns its behavior.
     */
    renderLoginAndRetryAction: (onAction) => (
      <Button
        variant={ButtonVariant.Neutral}
        appearance={ButtonAppearance.Outlined}
        size={ElementSize.Small}
        label={t(ScheduledTasksI18nKeys.LoginAndRetryAction)}
        onClick={onAction}
      />
    ),
  });

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
      <div role="alert" className="size-full">
        <StateScreen
          icon={
            <IconAlertTriangle
              aria-hidden
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          title={t(ScheduledTasksI18nKeys.EditLoadErrorLabel)}
          action={
            <GhostButton
              label={t(ScheduledTasksI18nKeys.ListRetryLabel)}
              onClick={handleRetry}
            />
          }
        />
      </div>
    );
  }

  if (isUnsupported || !values || !task) {
    return (
      <div role="alert" className="size-full">
        <StateScreen
          icon={
            <IconAlertTriangle
              aria-hidden
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          title={t(ScheduledTasksI18nKeys.EditInvalidScheduleLabel)}
          action={
            <GhostButton
              label={t(ScheduledTasksI18nKeys.CreateBackButtonLabel)}
              onClick={handleBack}
            />
          }
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
      skillSelector={
        <ScheduledTaskSkillField
          fieldLabel={labels.skillLabel}
          value={values.skillUrls ?? []}
          onChange={(value) => handleFieldChange('skillUrls', value)}
          isSkillsSupported={isSkillsSupported}
          isDisabled={isSubmitting}
          error={effectiveErrors.skillUrls}
        />
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
