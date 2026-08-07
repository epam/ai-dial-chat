import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { getApiErrorDetails } from '../../server-api/api-error';
import { createScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { validateScheduledTaskForm } from '../../utils/scheduled-task-form-validation';
import { mapFormValuesToCreateBody } from '../../utils/scheduled-task-trigger';
import NotFoundPage from '../NotFound/NotFound';

const MAX_ASCII_CONTROL_CODE = 31;
const ASCII_DELETE_CODE = 127;

const DEFAULT_VALUES: ScheduledTaskCreateFormValues = {
  displayName: '',
  scheduleType: ScheduledTaskScheduleType.Recurring,
  frequency: ScheduledTaskFrequency.Daily,
  time: '09:00',
  startDate: undefined,
  endDate: undefined,
  modelId: '',
  prompt: '',
};

const containsControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= MAX_ASCII_CONTROL_CODE || codePoint === ASCII_DELETE_CODE)
    );
  });

const resolveReturnUrl = (candidate: string | null): string => {
  if (
    candidate === null ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    containsControlCharacter(candidate)
  ) {
    return ROUTES.ScheduledTasks;
  }
  return candidate;
};

const ScheduledTaskCreatePage: FC = () => {
  const { t } = useTranslation();
  const { status: appConfigStatus } = useAppConfig();
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items: deploymentItems } = useDeployments();
  const { showNotification } = useNotification();
  const { currentTheme } = useTheme();

  const markdownEditorTheme: 'light' | 'dark' =
    currentTheme === ThemeId.Dark ? 'dark' : 'light';

  const [values, setValues] =
    useState<ScheduledTaskCreateFormValues>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<ScheduledTaskCreateFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnUrl = useMemo(
    () =>
      resolveReturnUrl(searchParams.get(ScheduledTaskCreateQuery.ReturnUrl)),
    [searchParams],
  );

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
      pageTitle: t(ScheduledTasksI18nKeys.CreatePageTitle),
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
      setValues((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = useCallback(async () => {
    const nextErrors = validateScheduledTaskForm(values, t);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await createScheduledTask(mapFormValuesToCreateBody(values));
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ScheduledTasksI18nKeys.CreateSuccessNotification),
      });
      navigate(returnUrl, { state: { refresh: true } });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ScheduledTasksI18nKeys.CreateErrorNotification),
        requestId: traceId,
      });
      setIsSubmitting(false);
    }
  }, [values, showNotification, t, navigate, returnUrl]);

  if (appConfigStatus !== UserConfigStatus.Ready) {
    return <RouteFallback />;
  }

  if (!isEnabled) {
    return <NotFoundPage />;
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
      onSubmit={() => void handleSubmit()}
      isSubmitting={isSubmitting}
      markdownEditorTheme={markdownEditorTheme}
    />
  );
};

export default memo(ScheduledTaskCreatePage);
