import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { prepareScheduledTaskCreateBody } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
import {
  hasScheduledTaskFormChanges,
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  EditorThemes,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useEffect, useId, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import DeploymentSelectorFieldTrigger from '../../components/DeploymentSelector/DeploymentSelectorFieldTrigger';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import ScheduledTaskSkillField from '../../components/ScheduledTaskSkillField/ScheduledTaskSkillField';
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
import { createScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import {
  getLiveScheduledTaskFieldError,
  mapScheduledTaskValidationErrors,
} from '../../utils/scheduled-task-form-validation';
import NotFoundPage from '../NotFound/NotFound';

const DEFAULT_VALUES: ScheduledTaskCreateFormValues = {
  displayName: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  minute: '0',
  everyWeeks: '1',
  startDate: undefined,
  endDate: undefined,
  modelId: '',
  prompt: '',
};

const ScheduledTaskCreatePage: FC = () => {
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
  const { key: draftKey } = useLocation();
  const { showSuccessNotification } = useNotification();
  const { currentTheme } = useTheme();
  const modelLabelId = useId();

  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

  const [values, setValues] =
    useState<ScheduledTaskCreateFormValues>(DEFAULT_VALUES);
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

  const returnUrl = ROUTES.ScheduledTasks;

  /* The page owns the unsaved-changes guard, so the form gets no
   * `initialValues` and shows no dialog of its own. */
  const { allowNextNavigation } = useBuilderLeaveGuard({
    isDirty: hasScheduledTaskFormChanges(values, DEFAULT_VALUES),
  });

  const labels = useScheduledTaskFormLabels('create');

  const handleFieldChange = useCallback(
    <K extends keyof ScheduledTaskCreateFormValues>(
      field: K,
      value: ScheduledTaskCreateFormValues[K],
    ) => {
      setValues((prev) => ({ ...prev, [field]: value }));
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

  /*
   * The whole submit orchestration (in-flight state, failure branches,
   * login-required toast, login-and-retry handshake) is the shared
   * `useScheduledTaskSubmit` flow — the handlers below supply this page's
   * own pieces.
   */

  /** Prepares the create body from the current values; `null` when validation fails (field errors already applied). */
  const prepareCreateBody = useCallback(() => {
    const prepared = prepareScheduledTaskCreateBody(values, {
      now: new Date(),
      isSkillsSupported,
    });
    if (!prepared.ok) {
      setErrors(mapScheduledTaskValidationErrors(prepared.errors, t));
      return null;
    }
    return prepared.body;
  }, [values, isSkillsSupported, t]);

  /** Runs the normal create success path (success toast + navigation back to the task list). */
  const handleCreateSuccess = useCallback(() => {
    showSuccessNotification({
      message: t(ScheduledTasksI18nKeys.CreateSuccessNotification),
    });
    allowNextNavigation();
    navigate(returnUrl, { state: { refresh: true } });
  }, [showSuccessNotification, t, allowNextNavigation, navigate, returnUrl]);

  const { isSubmitting, handleSubmit } = useScheduledTaskSubmit({
    prepare: prepareCreateBody,
    save: createScheduledTask,
    onSuccess: handleCreateSuccess,
    onFieldErrors: setErrors,
    errorKey: ScheduledTasksI18nKeys.CreateErrorNotification,
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

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
  }

  return (
    <ScheduledTaskCreateForm
      key={draftKey}
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
      onSubmit={() => void handleSubmit()}
      isSubmitting={isSubmitting}
      markdownEditorTheme={markdownEditorTheme}
    />
  );
};

export default memo(ScheduledTaskCreatePage);
