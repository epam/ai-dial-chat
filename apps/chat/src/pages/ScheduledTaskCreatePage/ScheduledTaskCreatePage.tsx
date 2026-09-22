import { getApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import { prepareScheduledTaskCreateBody } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import {
  ScheduledTaskCreateForm,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
import { memo, useCallback, useId, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import DeploymentSelectorFieldTrigger from '../../components/DeploymentSelector/DeploymentSelectorFieldTrigger';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { ScheduledTaskCreateQuery } from '../../constants/scheduled-tasks';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useScheduledTaskFormLabels } from '../../hooks/scheduled-tasks/useScheduledTaskFormLabels';
import { createScheduledTask } from '../../server-api/scheduled-tasks.api';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import { UserConfigStatus } from '../../types/user-config-status';
import { mapScheduledTaskValidationErrors } from '../../utils/scheduled-task-form-validation';
import NotFoundPage from '../NotFound/NotFound';

const MAX_ASCII_CONTROL_CODE = 31;
const ASCII_DELETE_CODE = 127;

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
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { currentTheme } = useTheme();
  const modelLabelId = useId();

  const markdownEditorTheme: EditorThemes =
    currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light;

  const [values, setValues] =
    useState<ScheduledTaskCreateFormValues>(DEFAULT_VALUES);
  const [errors, setErrors] = useState<ScheduledTaskCreateFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnUrl = useMemo(
    () =>
      resolveReturnUrl(searchParams.get(ScheduledTaskCreateQuery.ReturnUrl)),
    [searchParams],
  );

  const labels = useScheduledTaskFormLabels('create');

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

  const handleSubmit = useCallback(async () => {
    const prepared = prepareScheduledTaskCreateBody(values, {
      now: new Date(),
    });
    if (!prepared.ok) {
      setErrors(mapScheduledTaskValidationErrors(prepared.errors, t));
      return;
    }

    setIsSubmitting(true);
    try {
      await createScheduledTask(prepared.body);
      showSuccessNotification({
        message: t(ScheduledTasksI18nKeys.CreateSuccessNotification),
      });
      navigate(returnUrl, { state: { refresh: true } });
    } catch (error) {
      const { traceId } = await getApiErrorDetails(error);
      showErrorNotification({
        message: t(ScheduledTasksI18nKeys.CreateErrorNotification),
        requestId: traceId,
      });
      setIsSubmitting(false);
    }
  }, [
    values,
    showSuccessNotification,
    showErrorNotification,
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
      labels={labels}
      values={values}
      errors={errors}
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
