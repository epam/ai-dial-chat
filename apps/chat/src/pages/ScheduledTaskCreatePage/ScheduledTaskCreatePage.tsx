import {
  ScheduledTaskErrorCode,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { prepareScheduledTaskCreateBody } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
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
import { OfflineCredentialsLoginOutcomeType } from '../../hooks/offlineCredentials/useOfflineCredentialsLogin';
import { useScheduledTaskAuthAutoLogin } from '../../hooks/scheduled-tasks/useScheduledTaskAuthAutoLogin';
import { useScheduledTaskFormLabels } from '../../hooks/scheduled-tasks/useScheduledTaskFormLabels';
import { useScheduledTaskSkillSupport } from '../../hooks/scheduled-tasks/useScheduledTaskSkillSupport';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { createScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { resolveScheduledTaskErrorMessage } from '../../utils/map-scheduled-task-dto';
import { checkScheduledTaskAuthSessionError } from '../../utils/scheduled-task-auth-error';
import {
  getLiveScheduledTaskFieldError,
  mapScheduledTaskValidationErrors,
  mapScheduledTaskApiError,
} from '../../utils/scheduled-task-form-validation';
import NotFoundPage from '../NotFound/NotFound';

const DEFAULT_VALUES: ScheduledTaskCreateFormValues = {
  displayName: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
  minute: '0',
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
  const location = useLocation();
  const { key: draftKey } = location;
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { currentTheme } = useTheme();
  const modelLabelId = useId();

  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

  const [values, setValues] =
    useState<ScheduledTaskCreateFormValues>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<ScheduledTaskCreateFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const showAutoLoginFailedNotification = useCallback(
    (traceId?: string) =>
      showErrorNotification({
        message: t(ScheduledTasksI18nKeys.AutoLoginFailedNotification),
        requestId: traceId,
      }),
    [showErrorNotification, t],
  );

  const { reserveLoginPopup, autoLogin } = useScheduledTaskAuthAutoLogin();

  /**
   * Handles a failed submit; resolves `true` only when the failure was
   * attributed to the logged-out external Scheduler auth service and the
   * reserved-popup auto-login succeeded, so the caller retries the submit
   * once. Every other path resolves `false` after surfacing its own
   * feedback (field errors or a toast).
   */
  const handleSubmitError = useCallback(
    async (error: unknown, reservedPopup: Window | null): Promise<boolean> => {
      try {
        const details = await getApiErrorDetails(error);
        const { traceId, code } = details;
        const fieldErrors = mapScheduledTaskApiError(code, t);
        if (fieldErrors) {
          setErrors(fieldErrors);
          return false;
        }

        /*
         * A revoked scheduler consent is fixed by an administrator, not by a
         * login: it short-circuits before the 403 disambiguation below, so a
         * consent revocation is never mistaken for a logged-out auth
         * service and never drives the auto-login.
         */
        if (code === ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired) {
          showErrorNotification({
            message: resolveScheduledTaskErrorMessage(
              details,
              ScheduledTasksI18nKeys.CreateErrorNotification,
              t,
            ),
            requestId: traceId,
          });
          return false;
        }

        /*
         * A bare 403 is either a genuine permission denial or the external
         * Scheduler auth service being logged out (Core returns the same
         * bare status for both). One fresh status check disambiguates
         * (issue #9046); an attributed failure with usable client settings
         * drives the reserved-popup auto-login, so the page and its unsaved
         * form state stay alive while the OAuth popup runs — the popup was
         * reserved synchronously at click time, because one opened after
         * the save POST would be blocked by the popup blocker. A
         * user-closed popup stays silent; every other failed outcome takes
         * the failed-login toast. An attributed failure with no usable
         * authorize URL, or with no usable settings at all, keeps the
         * generic error handling below.
         */
        const check = await checkScheduledTaskAuthSessionError(error);
        if (check.isAuthSessionError && check.connect != null) {
          const outcome = await autoLogin(check.connect, reservedPopup);
          if (outcome.type === OfflineCredentialsLoginOutcomeType.Success) {
            return true;
          }
          if (outcome.type !== OfflineCredentialsLoginOutcomeType.Cancelled) {
            showAutoLoginFailedNotification(traceId);
          }
          return false;
        }

        showErrorNotification({
          /* DIAL Scheduler's own reason when it sent one; never the BFF's
           * generic English-only `message`. */
          message: resolveScheduledTaskErrorMessage(
            details,
            ScheduledTasksI18nKeys.CreateErrorNotification,
            t,
          ),
          requestId: traceId,
        });
        return false;
      } catch {
        /* The error handler itself must never surface as an unhandled
           rejection on top of a failed submit. */
        showErrorNotification({
          message: t(ScheduledTasksI18nKeys.CreateErrorNotification),
        });
        return false;
      }
    },
    [autoLogin, showAutoLoginFailedNotification, showErrorNotification, t],
  );

  const handleSubmit = useCallback(async () => {
    const prepared = prepareScheduledTaskCreateBody(values, {
      now: new Date(),
      isSkillsSupported,
    });
    if (!prepared.ok) {
      setErrors(mapScheduledTaskValidationErrors(prepared.errors, t));
      return;
    }

    /*
     * Reserved while the click's user activation is still fresh — see
     * useScheduledTaskAuthAutoLogin. Closed in the finally below when the
     * submit never needed a login.
     */
    const reservedPopup = reserveLoginPopup();

    let isCreated = false;
    setIsSubmitting(true);
    try {
      try {
        await createScheduledTask(prepared.body);
        isCreated = true;
      } catch (error) {
        if (await handleSubmitError(error, reservedPopup)) {
          try {
            await createScheduledTask(prepared.body);
            isCreated = true;
          } catch (retryError) {
            /*
             * The post-login retry takes the generic path — its fresh status
             * check reports connected, so it cannot re-trigger the
             * auto-login.
             */
            await handleSubmitError(retryError, null);
          }
        }
      }
      if (isCreated) {
        showSuccessNotification({
          message: t(ScheduledTasksI18nKeys.CreateSuccessNotification),
        });
        navigate(returnUrl, { state: { refresh: true } });
      }
    } finally {
      if (reservedPopup && !reservedPopup.closed) {
        reservedPopup.close();
      }
      setIsSubmitting(false);
    }
  }, [
    values,
    isSkillsSupported,
    showSuccessNotification,
    handleSubmitError,
    reserveLoginPopup,
    t,
    navigate,
    returnUrl,
  ]);

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
      initialValues={DEFAULT_VALUES}
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
