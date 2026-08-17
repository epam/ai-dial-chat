import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  PromptEditor as PromptEditorForm,
  type PromptEditorErrors,
  type PromptEditorLabels,
  type PromptEditorValues,
} from '@epam/ai-dial-prompt-editor';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import {
  ButtonsI18nKeys,
  PromptEditorI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { usePrompts } from '../../context/PromptsContext';
import { useTheme } from '../../context/ThemeContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getApiErrorDetails } from '../../server-api/api-error';
import {
  createPrompt,
  getPrompt,
  updatePrompt,
} from '../../server-api/prompts.api';
import { EditorQuery } from '../../types/editor-query';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { PromptFieldError } from '../../types/prompt';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import {
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_DESCRIPTION_MAX_LENGTH,
  validatePromptContent,
  validatePromptDescription,
  validatePromptName,
} from '../../utils/prompt';

interface FormErrors {
  name?: PromptFieldError;
  description?: PromptFieldError;
  content?: PromptFieldError;
}

const PromptEditorPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { currentTheme } = useTheme();
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const { refetchPrompts } = usePrompts();

  const promptId = searchParams.get(EditorQuery.Id) ?? undefined;
  const returnUrl = searchParams.get(EditorQuery.ReturnUrl) ?? ROUTES.Catalog;
  const isEditMode = promptId != null;

  const [loadedValues, setLoadedValues] = useState<PromptEditorValues>();
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!isPromptsEnabled) {
      navigate(ROUTES.Catalog, { replace: true });
    }
  }, [isPromptsEnabled, navigate]);

  /*
   * Loads the prompt being edited. A failure surfaces an explicit error state
   * with a retry rather than an empty create form, which would silently invite
   * the user to author a duplicate.
   */
  useEffect(() => {
    if (!isPromptsEnabled || promptId == null) return;
    const cancelled = { value: false };

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const dto = await getPrompt(promptId);
        if (cancelled.value) return;
        setLoadedValues({
          name: dto.name,
          description: dto.description ?? '',
          content: dto.content,
        });
      } catch (err) {
        if (!cancelled.value) setLoadError(err);
      } finally {
        if (!cancelled.value) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, [promptId, isPromptsEnabled, loadAttempt]);

  const resolveNameError = useCallback(
    (error?: PromptFieldError) => {
      if (error == null) return undefined;
      if (error === PromptFieldError.Required) {
        return t(PromptEditorI18nKeys.ErrorRequired);
      }
      if (error === PromptFieldError.TooLong) {
        return t(PromptEditorI18nKeys.ErrorNameTooLong);
      }
      if (error === PromptFieldError.Conflict) {
        return t(PromptEditorI18nKeys.ErrorNameConflict);
      }
      return t(PromptEditorI18nKeys.ErrorNameInvalid);
    },
    [t],
  );

  const formErrors = useMemo<PromptEditorErrors>(() => {
    const resolveLengthError = (
      error: PromptFieldError | undefined,
      tooLongKey: PromptEditorI18nKeys,
    ) => {
      if (error == null) return undefined;
      if (error === PromptFieldError.TooLong) return t(tooLongKey);
      return resolveNameError(error);
    };

    return {
      name: resolveNameError(errors.name),
      description: resolveLengthError(
        errors.description,
        PromptEditorI18nKeys.ErrorDescriptionTooLong,
      ),
      content: resolveLengthError(
        errors.content,
        PromptEditorI18nKeys.ErrorContentTooLong,
      ),
    };
  }, [errors, resolveNameError, t]);

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleBack = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleRetry = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleSubmit = useCallback(
    async ({ name, description, content }: PromptEditorValues) => {
      if (isSaving) return;

      const nextErrors: FormErrors = {};
      const nameError = validatePromptName(name);
      if (nameError) nextErrors.name = nameError;
      const descriptionError = validatePromptDescription(description);
      if (descriptionError) nextErrors.description = descriptionError;
      const contentError = validatePromptContent(content);
      if (contentError) nextErrors.content = contentError;

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }
      setErrors({});
      setIsSaving(true);

      const trimmedName = name.trim();

      try {
        if (!isEditMode) {
          await createPrompt({
            name: trimmedName,
            description: description || undefined,
            content,
          });
        } else {
          await updatePrompt(promptId, {
            name: trimmedName,
            description,
            content,
          });
        }

        await refetchPrompts();
        notifyOperationSuccess(
          NotifiableEntity.Prompt,
          isEditMode ? EntityOperation.Edited : EntityOperation.Created,
          { name: trimmedName },
        );
        navigate(returnUrl);
      } catch (err) {
        const { status, traceId } = await getApiErrorDetails(err);
        if (status === 409) {
          setErrors({ name: PromptFieldError.Conflict });
          return;
        }
        showErrorNotification({
          message: t(PromptEditorI18nKeys.SaveError),
          requestId: traceId,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      isEditMode,
      promptId,
      refetchPrompts,
      notifyOperationSuccess,
      showErrorNotification,
      t,
      navigate,
      returnUrl,
    ],
  );

  const labels = useMemo<PromptEditorLabels>(
    () => ({
      createTitle: t(PromptEditorI18nKeys.CreateTitle),
      editTitle: t(PromptEditorI18nKeys.EditTitle),
      backButtonLabel: t(PromptEditorI18nKeys.BackButtonLabel),
      nameLabel: t(PromptEditorI18nKeys.NameLabel),
      namePlaceholder: t(PromptEditorI18nKeys.NamePlaceholder),
      descriptionLabel: t(PromptEditorI18nKeys.DescriptionLabel),
      descriptionPlaceholder: t(PromptEditorI18nKeys.DescriptionPlaceholder),
      contentLabel: t(PromptEditorI18nKeys.ContentLabel),
      contentPlaceholder: t(PromptEditorI18nKeys.ContentPlaceholder),
      saveLabel: t(ButtonsI18nKeys.Save),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      retryLabel: t(PromptEditorI18nKeys.RetryLabel),
      loadErrorMessage: t(PromptEditorI18nKeys.LoadError),
      savingStatusLabel: t(PromptEditorI18nKeys.SavingStatus),
      loadingAriaLabel: t(PromptEditorI18nKeys.LoadingAriaLabel),
      contentLoadingAriaLabel: t(PromptEditorI18nKeys.ContentLoadingAriaLabel),
      charactersRemaining: (count) =>
        t(PromptEditorI18nKeys.CharactersRemaining, { count }),
    }),
    [t],
  );

  if (!isPromptsEnabled) return null;

  return (
    <PromptEditorForm
      isEditMode={isEditMode}
      initialValues={loadedValues}
      isLoading={isLoading}
      hasLoadError={loadError != null}
      isSaving={isSaving}
      errors={formErrors}
      descriptionMaxLength={PROMPT_DESCRIPTION_MAX_LENGTH}
      contentMaxLength={PROMPT_CONTENT_MAX_LENGTH}
      labels={labels}
      markdownEditorTheme={
        currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light
      }
      onSubmit={handleSubmit}
      onBack={handleBack}
      onCancel={handleCancel}
      onRetry={handleRetry}
    />
  );
};

export default memo(PromptEditorPage);
