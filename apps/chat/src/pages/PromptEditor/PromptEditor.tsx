import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  PromptEditor as PromptEditorForm,
  type PromptEditorErrors,
  type PromptEditorLabels,
  type PromptEditorValues,
  type PromptFolderActions,
} from '@epam/ai-dial-prompt-editor';
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
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getApiErrorDetails } from '../../server-api/api-error';
import {
  createPrompt,
  createPromptFolder,
  deletePromptFolder,
  getPrompt,
  movePrompt,
  renamePromptFolder,
  updatePrompt,
} from '../../server-api/prompts.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { PromptFieldError } from '../../types/prompt';
import { PromptEditorQuery } from '../../types/prompt-editor';
import { ROUTES } from '../../types/routes';
import {
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_DESCRIPTION_MAX_LENGTH,
  validatePromptContent,
  validatePromptDescription,
  validatePromptName,
} from '../../utils/prompt';

/** Root folder is modelled as the empty string, matching the prompts API. */
const ROOT_FOLDER_ID = '';

interface FormErrors {
  name?: PromptFieldError;
  description?: PromptFieldError;
  content?: PromptFieldError;
  folder?: PromptFieldError;
}

const PromptEditorPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const { folders, refetchPrompts } = usePrompts();

  const promptId = searchParams.get(PromptEditorQuery.Id) ?? undefined;
  const returnUrl =
    searchParams.get(PromptEditorQuery.ReturnUrl) ?? ROUTES.Catalog;
  const isEditMode = promptId != null;

  const [loadedValues, setLoadedValues] = useState<PromptEditorValues>();
  const [initialFolderId, setInitialFolderId] = useState(ROOT_FOLDER_ID);
  const [errors, setErrors] = useState<FormErrors>({});
  const [folderNameError, setFolderNameError] = useState<PromptFieldError>();
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
          folderId: dto.folderId,
        });
        setInitialFolderId(dto.folderId);
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
      folder:
        errors.folder != null
          ? t(PromptEditorI18nKeys.ErrorFolderConflict)
          : undefined,
    };
  }, [errors, resolveNameError, t]);

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleRetry = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleSubmit = useCallback(
    async ({ name, description, content, folderId }: PromptEditorValues) => {
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
            folderId,
          });
        } else {
          /*
           * `updatePrompt` cannot change a prompt's folder, so a folder change
           * is a second call. Update runs first so the move operates on the
           * post-rename path.
           */
          const updated = await updatePrompt(promptId, {
            name: trimmedName,
            description,
            content,
          });
          if (folderId !== initialFolderId) {
            try {
              await movePrompt(updated.id, { targetFolderId: folderId });
            } catch (moveErr) {
              const { traceId } = await getApiErrorDetails(moveErr);
              await refetchPrompts();
              setErrors({ folder: PromptFieldError.Conflict });
              showErrorNotification({
                message: t(PromptEditorI18nKeys.MoveError),
                requestId: traceId,
              });
              return;
            }
          }
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
      initialFolderId,
      refetchPrompts,
      notifyOperationSuccess,
      showErrorNotification,
      t,
      navigate,
      returnUrl,
    ],
  );

  const reportFolderFailure = useCallback(
    async (err: unknown) => {
      const { status, traceId } = await getApiErrorDetails(err);
      if (status === 409) {
        setFolderNameError(PromptFieldError.Conflict);
        return;
      }
      showErrorNotification({
        message: t(PromptEditorI18nKeys.FolderError),
        requestId: traceId,
      });
    },
    [showErrorNotification, t],
  );

  const folderActions = useMemo<PromptFolderActions>(
    () => ({
      onCreateFolder: async (name, parentId) => {
        setFolderNameError(undefined);
        try {
          const created = await createPromptFolder({ name, parentId });
          await refetchPrompts();
          return created.id;
        } catch (err) {
          await reportFolderFailure(err);
          throw err;
        }
      },
      onRenameFolder: async (folderId, name) => {
        setFolderNameError(undefined);
        try {
          const renamed = await renamePromptFolder(folderId, { name });
          await refetchPrompts();
          return renamed.id;
        } catch (err) {
          await reportFolderFailure(err);
          throw err;
        }
      },
      onDeleteFolder: async (folderId) => {
        setFolderNameError(undefined);
        try {
          await deletePromptFolder(folderId);
          await refetchPrompts();
        } catch (err) {
          await reportFolderFailure(err);
          throw err;
        }
      },
      onValidateFolderName: (name) =>
        resolveNameError(validatePromptName(name) ?? undefined),
    }),
    [refetchPrompts, reportFolderFailure, resolveNameError],
  );

  const labels = useMemo<PromptEditorLabels>(
    () => ({
      createTitle: t(PromptEditorI18nKeys.CreateTitle),
      editTitle: t(PromptEditorI18nKeys.EditTitle),
      nameLabel: t(PromptEditorI18nKeys.NameLabel),
      namePlaceholder: t(PromptEditorI18nKeys.NamePlaceholder),
      descriptionLabel: t(PromptEditorI18nKeys.DescriptionLabel),
      descriptionPlaceholder: t(PromptEditorI18nKeys.DescriptionPlaceholder),
      contentLabel: t(PromptEditorI18nKeys.ContentLabel),
      contentPlaceholder: t(PromptEditorI18nKeys.ContentPlaceholder),
      folderLabel: t(PromptEditorI18nKeys.FolderLabel),
      folderRootOption: t(PromptEditorI18nKeys.FolderRootOption),
      folderEmptyState: t(PromptEditorI18nKeys.FolderEmptyState),
      folderCreateLabel: t(PromptEditorI18nKeys.FolderCreateLabel),
      folderRenameLabel: t(PromptEditorI18nKeys.FolderRenameLabel),
      folderDeleteLabel: t(PromptEditorI18nKeys.FolderDeleteLabel),
      folderNameLabel: t(PromptEditorI18nKeys.FolderNameLabel),
      folderDeleteConfirmTitle: t(
        PromptEditorI18nKeys.FolderDeleteConfirmTitle,
      ),
      folderDeleteConfirmMessage: (folderId) =>
        t(PromptEditorI18nKeys.FolderDeleteConfirmMessage, { name: folderId }),
      saveLabel: t(ButtonsI18nKeys.Save),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      retryLabel: t(PromptEditorI18nKeys.RetryLabel),
      loadErrorMessage: t(PromptEditorI18nKeys.LoadError),
      savingStatusLabel: t(PromptEditorI18nKeys.SavingStatus),
      loadingAriaLabel: t(PromptEditorI18nKeys.LoadingAriaLabel),
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
      folders={folders}
      isLoading={isLoading}
      hasLoadError={loadError != null}
      isSaving={isSaving}
      errors={formErrors}
      descriptionMaxLength={PROMPT_DESCRIPTION_MAX_LENGTH}
      contentMaxLength={PROMPT_CONTENT_MAX_LENGTH}
      folderNameError={resolveNameError(folderNameError)}
      folderActions={folderActions}
      labels={labels}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      onRetry={handleRetry}
    />
  );
};

export default memo(PromptEditorPage);
