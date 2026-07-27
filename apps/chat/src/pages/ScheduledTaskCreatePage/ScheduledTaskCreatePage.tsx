import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
} from '@epam/ai-dial-scheduled-tasks';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import {
  ButtonsI18nKeys,
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { createScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { mapFormValuesToCreateBody } from '../../utils/scheduled-task-trigger';
import NotFoundPage from '../NotFound/NotFound';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_ASCII_CONTROL_CODE = 31;
const ASCII_DELETE_CODE = 127;
const DESCRIPTION_MAX_LENGTH = 500;

const DEFAULT_VALUES: ScheduledTaskCreateFormValues = {
  displayName: '',
  scheduleType: 'recurring',
  frequency: 'daily',
  time: '09:00',
  modelId: '',
  prompt: '',
  stream: true,
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
  const isEnabled = useFeatureFlag('scheduledTasksEnabled');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items: deploymentItems } = useDeployments();
  const { showNotification } = useNotification();

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
          key: 'daily' as const,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyDaily),
        },
        {
          key: 'weekly' as const,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyWeekly),
        },
        {
          key: 'monthly' as const,
          label: t(ScheduledTasksI18nKeys.CreateFrequencyMonthly),
        },
      ],
      timeLabel: t(ScheduledTasksI18nKeys.CreateTimeLabel),
      dayOfWeekLabel: t(ScheduledTasksI18nKeys.CreateDayOfWeekLabel),
      dayOfMonthLabel: t(ScheduledTasksI18nKeys.CreateDayOfMonthLabel),
      modelLabel: t(ScheduledTasksI18nKeys.CreateModelLabel),
      modelPlaceholder: t(ScheduledTasksI18nKeys.CreateModelPlaceholder),
      descriptionLabel: t(ScheduledTasksI18nKeys.CreateDescriptionLabel),
      promptLabel: t(ScheduledTasksI18nKeys.CreatePromptLabel),
      streamLabel: t(ScheduledTasksI18nKeys.CreateStreamLabel),
      cancelButtonLabel: t(ButtonsI18nKeys.Cancel),
      createButtonLabel: t(ButtonsI18nKeys.Create),
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

  const validate = useCallback(
    (data: ScheduledTaskCreateFormValues): ScheduledTaskCreateFormErrors => {
      const nextErrors: ScheduledTaskCreateFormErrors = {};

      if (!data.displayName.trim()) {
        nextErrors.displayName = t(EditorI18nKeys.NameRequired);
      }
      if (!data.modelId) {
        nextErrors.modelId = t(ScheduledTasksI18nKeys.CreateModelRequired);
      }
      if (!data.prompt.trim()) {
        nextErrors.prompt = t(ScheduledTasksI18nKeys.CreatePromptRequired);
      }
      if ((data.description?.length ?? 0) > DESCRIPTION_MAX_LENGTH) {
        nextErrors.description = t(
          ScheduledTasksI18nKeys.CreateDescriptionMaxLengthError,
        );
      }

      if (data.scheduleType === 'once') {
        const runAtTime = data.runAt ? new Date(data.runAt).getTime() : NaN;
        if (!data.runAt || Number.isNaN(runAtTime) || runAtTime <= Date.now()) {
          nextErrors.runAt = t(ScheduledTasksI18nKeys.CreateRunAtRequired);
        }
      } else {
        if (!TIME_PATTERN.test(data.time)) {
          nextErrors.time = t(ScheduledTasksI18nKeys.CreateTimeInvalid);
        }
        if (data.frequency === 'weekly' && !data.dayOfWeek?.trim()) {
          nextErrors.dayOfWeek = t(
            ScheduledTasksI18nKeys.CreateDayOfWeekRequired,
          );
        }
        if (data.frequency === 'monthly' && !data.dayOfMonth?.trim()) {
          nextErrors.dayOfMonth = t(
            ScheduledTasksI18nKeys.CreateDayOfMonthRequired,
          );
        }
      }

      return nextErrors;
    },
    [t],
  );

  const handleSubmit = useCallback(async () => {
    const nextErrors = validate(values);
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
    } catch {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ScheduledTasksI18nKeys.CreateErrorNotification),
      });
      setIsSubmitting(false);
    }
  }, [values, validate, showNotification, t, navigate, returnUrl]);

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
      onCancel={handleCancel}
      onSubmit={() => void handleSubmit()}
      isSubmitting={isSubmitting}
    />
  );
};

export default memo(ScheduledTaskCreatePage);
