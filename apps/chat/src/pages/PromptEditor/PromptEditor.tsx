import {
  CatalogCreationType,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  PROMPT_CONTENT_MAX_LENGTH,
  PROMPT_DESCRIPTION_MAX_LENGTH,
  PROMPT_FIELD_VALIDATORS,
  PromptFieldError,
  type PromptFieldErrors,
  validatePromptContent,
  validatePromptDescription,
  validatePromptName,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  PromptEditor as PromptEditorForm,
  type PromptEditorErrors,
  type PromptEditorLabels,
  type PromptEditorValues,
} from '@epam/ai-dial-prompt-editor';
import { EditorThemes } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import RequireCatalogCreation from '../../components/RequireCatalogCreation/RequireCatalogCreation';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  PromptEditorI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { usePrompts } from '../../context/PromptsContext';
import { useTheme } from '../../context/ThemeContext';
import { useCatalogCreationDecision } from '../../hooks/catalog/useCatalogCreationDecision';
import { useBuilderLeaveGuard } from '../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { useTextRefinementLabels } from '../../hooks/useTextRefinementLabels';
import { useUiFeature } from '../../hooks/useUiFeature';
import type {
  ResourceSaveAdapter,
  ResourceSaveResult,
} from '../../models/resource-save';
import {
  createPrompt,
  getPrompt,
  updatePrompt,
} from '../../server-api/prompts.api';
import { CatalogCreationDecision } from '../../types/catalog-creation';
import { EditorQuery } from '../../types/editor-query';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import {
  createPromptSaveAdapter,
  listPromptFolders,
} from '../../utils/resource-save-adapters/prompt';

/* Loaded on the first Save of an edit session, so opening the editor fetches no folder listing. */
const ResourceSavePanelContainer = lazy(
  async () =>
    import('../../components/ResourceSavePanelContainer/ResourceSavePanelContainer'),
);

/** What the Save panel needs for the save it was opened for. */
interface PromptSaveRequest {
  adapter: ResourceSaveAdapter;
  name: string;
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
  const returnUrl = ROUTES.Catalog;
  const isEditMode = promptId != null;
  const creationDecision = useCatalogCreationDecision({
    type: CatalogCreationType.Prompt,
  });

  const [loadedValues, setLoadedValues] = useState<PromptEditorValues>();
  const [errors, setErrors] = useState<PromptFieldErrors>({});
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  /* Only the user's own prompt saves through the Save panel: moving acts on the caller's bucket. */
  const [loadedPrompt, setLoadedPrompt] = useState<{
    isMy: boolean;
    folderPath: string[];
  }>();
  const [saveRequest, setSaveRequest] = useState<PromptSaveRequest>();
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  /* Reported by the form; passing `onDirtyChange` also turns its own guard off. */
  const [isDirty, setIsDirty] = useState(false);
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });

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
        setLoadedPrompt({
          isMy: dto.isMy === true,
          folderPath: dto.folderId ? dto.folderId.split('/') : [],
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

  /*
   * Length and name-pattern errors show while the user types; a Required error
   * keeps its submit timing, so it only persists (never appears) here.
   */
  const handleFieldChange = useCallback(
    (field: keyof PromptEditorValues, value: string) => {
      setErrors((previous) => {
        const error = PROMPT_FIELD_VALIDATORS[field](value) ?? undefined;
        const nextError =
          error === PromptFieldError.Required &&
          previous[field] !== PromptFieldError.Required
            ? undefined
            : error;
        if (nextError === previous[field]) return previous;
        return { ...previous, [field]: nextError };
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
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const handleSubmit = useCallback(
    async ({ name, description, content }: PromptEditorValues) => {
      if (isSaving) return;

      const nextErrors: PromptFieldErrors = {};
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
      /* The form may have opened under a permission the current config no
       * longer grants; nothing is created then. */
      if (!isEditMode && creationDecision !== CatalogCreationDecision.Allowed) {
        showErrorNotification({
          message: t(
            creationDecision === CatalogCreationDecision.Denied
              ? CatalogI18nKeys.CreationDenied
              : CatalogI18nKeys.CreationUnavailable,
          ),
        });
        return;
      }
      setErrors({});

      const trimmedName = name.trim();

      if (isEditMode && promptId != null && loadedPrompt?.isMy) {
        setSaveRequest({
          adapter: createPromptSaveAdapter({
            promptId,
            body: { name: trimmedName, description, content },
          }),
          name: trimmedName,
        });
        setIsSavePanelOpen(true);
        return;
      }

      setIsSaving(true);

      try {
        if (!isEditMode) {
          await createPrompt({
            name: trimmedName,
            description: description || undefined,
            content,
          });
        } else {
          const updateBody = {
            name: trimmedName,
            description,
            content,
          };
          await updatePrompt(promptId as string, updateBody);
        }

        await refetchPrompts();
        notifyOperationSuccess(
          NotifiableEntity.Prompt,
          isEditMode ? EntityOperation.Edited : EntityOperation.Created,
          { name: trimmedName },
        );
        allowNextNavigation();
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
      allowNextNavigation,
      creationDecision,
      isSaving,
      isEditMode,
      loadedPrompt,
      promptId,
      refetchPrompts,
      notifyOperationSuccess,
      showErrorNotification,
      t,
      navigate,
      returnUrl,
    ],
  );

  const handleSavePanelClose = useCallback(() => setIsSavePanelOpen(false), []);
  /* Every outcome reaching here saved the prompt; the panel has already notified. */
  const handleSavePanelSaved = useCallback(
    (_result: ResourceSaveResult) => {
      const leaveEditor = async () => {
        // Best-effort: brings the saved prompt into the catalog list.
        await refetchPrompts().catch(() => undefined);
        setIsSavePanelOpen(false);
        allowNextNavigation();
        navigate(returnUrl);
      };
      void leaveEditor();
    },
    [allowNextNavigation, navigate, refetchPrompts, returnUrl],
  );

  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.PromptDescription,
  );
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.PromptInstructions,
  );
  const refinementLabels = useTextRefinementLabels();
  const labels = useMemo<PromptEditorLabels>(
    () => ({
      ...refinementLabels,
      createTitle: t(PromptEditorI18nKeys.CreateTitle),
      editTitle: t(PromptEditorI18nKeys.EditTitle),
      backButtonAriaLabel: t(ButtonsI18nKeys.Back),
      nameLabel: t(PromptEditorI18nKeys.NameLabel),
      namePlaceholder: t(PromptEditorI18nKeys.NamePlaceholder),
      descriptionLabel: t(PromptEditorI18nKeys.DescriptionLabel),
      descriptionPlaceholder: t(PromptEditorI18nKeys.DescriptionPlaceholder),
      contentLabel: t(PromptEditorI18nKeys.ContentLabel),
      contentPlaceholder: t(PromptEditorI18nKeys.ContentPlaceholder),
      createLabel: t(ButtonsI18nKeys.Create),
      saveLabel: t(ButtonsI18nKeys.Save),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      retryLabel: t(ButtonsI18nKeys.TryAgain),
      loadErrorMessage: t(PromptEditorI18nKeys.LoadError),
      savingStatusLabel: t(ButtonsI18nKeys.Saving),
      loadingAriaLabel: t(PromptEditorI18nKeys.LoadingAriaLabel),
      contentLoadingAriaLabel: t(PromptEditorI18nKeys.ContentLoadingAriaLabel),
      charactersRemaining: (count) =>
        t(PromptEditorI18nKeys.CharactersRemaining, { count }),
    }),
    [t, refinementLabels],
  );

  if (!isPromptsEnabled) return null;

  return (
    <RequireCatalogCreation
      isCreateMode={!isEditMode}
      type={CatalogCreationType.Prompt}
    >
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
        onFieldChange={handleFieldChange}
        onBack={handleBack}
        onCancel={handleCancel}
        onDirtyChange={setIsDirty}
        onRetry={handleRetry}
        onRefineDescription={onRefineDescription}
        onRefineInstructions={onRefineInstructions}
      />
      {saveRequest && promptId != null && (
        <Suspense fallback={null}>
          <ResourceSavePanelContainer
            isOpen={isSavePanelOpen}
            onClose={handleSavePanelClose}
            adapter={saveRequest.adapter}
            listPersonalFolders={listPromptFolders}
            resourceId={promptId}
            currentFolderPath={loadedPrompt?.folderPath ?? []}
            resourceName={saveRequest.name}
            resourceType={CatalogEntityType.Prompt}
            typeLabel={t(CatalogI18nKeys.CreatePrompt)}
            notifiableEntity={NotifiableEntity.Prompt}
            canPublish
            onSaved={handleSavePanelSaved}
          />
        </Suspense>
      )}
    </RequireCatalogCreation>
  );
};

export default memo(PromptEditorPage);
