import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import {
  isValidSkillRelativePath,
  parseSkillResourceUrl,
  PUBLIC_SKILL_BUCKET,
  SkillEditorLoadState,
  SKILL_MANIFEST_FILE,
  useSkillEditorLoad,
  useSkillEditorSubmit,
  useSkillFileActions,
  type SkillEditorLoadClient,
  type SkillEditorSubmitClient,
  type SkillEditorSubmitMessages,
  type SkillFileActionsMessages,
} from '@epam/ai-dial-chat-hooks';
import {
  SkillEditor as SkillEditorForm,
  type SkillEditorLabels,
} from '@epam/ai-dial-skill-editor';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  EditorThemes,
  ErrorText,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { SkillFilePreview } from '../../components/SkillFilePreview/SkillFilePreview';
import { isSafeReturnUrl } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useSkills } from '../../context/SkillsContext';
import { useTheme } from '../../context/ThemeContext';
import { useSkillFilePreviewSync } from '../../hooks/attachment/useSkillFilePreviewSync';
import { useTextRefinementCallback } from '../../hooks/useTextRefinementCallback';
import { useTextRefinementLabels } from '../../hooks/useTextRefinementLabels';
import {
  createSkill,
  downloadSkill,
  downloadSkillFile,
  listSkillFiles,
  updateSkill,
} from '../../server-api/skills.api';
import { EditorQuery } from '../../types/editor-query';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';

const skillEditorLoadClient: SkillEditorLoadClient = {
  downloadSkill,
  downloadSkillFile,
  listSkillFiles,
};

const skillEditorSubmitClient: SkillEditorSubmitClient = {
  createSkill,
  updateSkill,
};

/* Stands in for the skill path while creating a skill that has none yet, so a
 * create-mode preview is still scoped to its own resource. */
const NEW_SKILL_CANVAS_SCOPE = '<new>';

/* Separates the resource scope from the file's relative path in a canvas key.
 * The key is only ever compared for equality, never parsed back, so an
 * ambiguous split point costs nothing; a collision would need one skill's path
 * to end with this character and absorb the next key's leading path segment. */
const CANVAS_SCOPE_SEPARATOR = '#';

const SkillEditorPage: FC = () => {
  const { t } = useTranslation();
  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.SkillDescription,
  );
  const onRefineInstructions = useTextRefinementCallback(
    TextRefinementPurpose.SkillInstructions,
  );
  const refinementLabels = useTextRefinementLabels();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { refetchSkills } = useSkills();
  const { currentTheme } = useTheme();
  const { closeCanvas } = useAttachmentCanvas();
  const { showNotification } = useNotification();

  const rawReturnUrl = searchParams.get(EditorQuery.ReturnUrl);
  const returnUrl =
    rawReturnUrl != null && isSafeReturnUrl(rawReturnUrl)
      ? rawReturnUrl
      : ROUTES.Catalog;
  const personalBucket = user?.bucket;

  const rawId = searchParams.get(EditorQuery.Id);
  const isEditMode = rawId != null && rawId !== '';
  const skillResource = useMemo(() => {
    if (!isEditMode) {
      return personalBucket
        ? { bucket: personalBucket, path: undefined }
        : null;
    }
    try {
      const decoded = decodeURIComponent(rawId);
      const parsed = parseSkillResourceUrl(decoded);
      if (parsed != null) {
        return parsed.bucket === PUBLIC_SKILL_BUCKET ? null : parsed;
      }
      return personalBucket && isValidSkillRelativePath(decoded)
        ? { bucket: personalBucket, path: decoded }
        : null;
    } catch {
      return null;
    }
  }, [isEditMode, personalBucket, rawId]);
  const bucket = skillResource?.bucket;
  const skillPath = skillResource?.path;
  const getCreateReturnUrl = useCallback(
    (path: string) =>
      `${ROUTES.Catalog}?${new URLSearchParams({
        itemId: `skills/${bucket}/${path}`,
      }).toString()}`,
    [bucket],
  );

  const {
    loadState,
    loadedValues,
    setLoadedValues,
    files,
    setFiles,
    filesContentRef,
    frontmatterRef,
    etagRef,
    loadedPathRef,
    retryLoad,
  } = useSkillEditorLoad({
    isEditMode,
    bucket,
    skillPath,
    client: skillEditorLoadClient,
  });

  const [selectedPath, setSelectedPath] = useState(SKILL_MANIFEST_FILE);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
  const [hasReturnedToManifest, setHasReturnedToManifest] = useState(false);

  const isManifestSelected = selectedPath === SKILL_MANIFEST_FILE;

  /*
   * The canvas is shared application state, so the key a preview is recorded
   * under has to identify the resource as well as the file: the same relative
   * path can exist in another skill, or in another bucket.
   */
  const canvasAttachmentId = useMemo(
    () =>
      isManifestSelected
        ? undefined
        : /* `bucket` is always set here — the page early-returns without one
             below — but the guard runs after this hook, so the type needs it. */
          `${bucket ?? ''}/${skillPath ?? NEW_SKILL_CANVAS_SCOPE}` +
          `${CANVAS_SCOPE_SEPARATOR}${selectedPath}`,
    [bucket, skillPath, isManifestSelected, selectedPath],
  );

  const { state: previewState, retry: retryPreview } = useSkillFilePreviewSync({
    selectedPath,
    canvasAttachmentId,
    files,
    filesContentRef,
  });

  const handleSelectedPathChange = useCallback((path: string) => {
    setSelectedPath(path);
    setHasReturnedToManifest(false);
  }, []);

  const fileActionsMessages = useMemo<SkillFileActionsMessages>(
    () => ({
      required: t(SkillEditorI18nKeys.ErrorRequired),
      pathReserved: t(SkillEditorI18nKeys.ErrorPathReserved),
      pathInvalid: t(SkillEditorI18nKeys.ErrorPathInvalid),
      pathDuplicate: t(SkillEditorI18nKeys.ErrorPathDuplicate),
      fileTooLarge: (maxSize) =>
        t(SkillEditorI18nKeys.ErrorFileTooLarge, { maxSize }),
      manifestCasingInvalid: t(SkillEditorI18nKeys.ErrorManifestCasingInvalid),
      manifestDuplicate: t(SkillEditorI18nKeys.ErrorManifestDuplicate),
      manifestInvalidUtf8: t(SkillEditorI18nKeys.ErrorManifestInvalidUtf8),
      manifestInvalidFrontmatter: t(
        SkillEditorI18nKeys.ErrorManifestInvalidFrontmatter,
      ),
      totalSizeExceeded: t(SkillEditorI18nKeys.ErrorTotalSizeExceeded),
      totalCountExceeded: t(SkillEditorI18nKeys.ErrorTotalCountExceeded),
      manifestNameMismatch: t(SkillEditorI18nKeys.ErrorManifestNameMismatch),
      manifestImportDeclined: t(
        SkillEditorI18nKeys.ErrorManifestImportDeclined,
      ),
      saveError: t(SkillEditorI18nKeys.ErrorSave),
    }),
    [t],
  );

  const { fileActions, pendingManifestImport, resolveManifestImport } =
    useSkillFileActions({
      files,
      setFiles,
      filesContentRef,
      frontmatterRef,
      loadedValues,
      setLoadedValues,
      isEditMode,
      isDirty,
      setSelectedPath,
      messages: fileActionsMessages,
    });

  const submitMessages = useMemo<SkillEditorSubmitMessages>(
    () => ({
      required: t(SkillEditorI18nKeys.ErrorRequired),
      instructionsFrontmatter: t(
        SkillEditorI18nKeys.ErrorInstructionsFrontmatter,
      ),
      nameInvalid: t(SkillEditorI18nKeys.ErrorNameInvalid),
      nameConflict: t(SkillEditorI18nKeys.ErrorNameConflict),
      archiveTooLarge: t(SkillEditorI18nKeys.ErrorArchiveTooLarge),
      serviceUnavailable: t(SkillEditorI18nKeys.ErrorServiceUnavailable),
      pathInvalid: t(SkillEditorI18nKeys.ErrorPathInvalid),
      saveError: t(SkillEditorI18nKeys.ErrorSave),
      saveSuccessTitle: t(SkillEditorI18nKeys.SaveSuccessTitle),
      createSuccess: (name) => t(SkillEditorI18nKeys.CreateSuccess, { name }),
      updateSuccessTitle: t(SkillEditorI18nKeys.UpdateSuccessTitle),
      updateSuccess: (name) => t(SkillEditorI18nKeys.UpdateSuccess, { name }),
      conflictMessage: t(SkillEditorI18nKeys.ConflictMessage),
    }),
    [t],
  );

  const {
    phase,
    errors,
    submitError,
    isSubmitErrorRetryable,
    retrySubmit,
    conflict,
    clearConflict,
    handleSubmit,
    handleValuesChange,
  } = useSkillEditorSubmit({
    bucket,
    isEditMode,
    files,
    filesContentRef,
    frontmatterRef,
    loadedPathRef,
    etagRef,
    returnUrl,
    getCreateReturnUrl,
    refetchSkills,
    client: skillEditorSubmitClient,
    messages: submitMessages,
    onNavigate: navigate,
    onNotify: showNotification,
  });

  /*
   * A skill stored with two frontmatter blocks (created before the editor
   * refused them) seeds an Instructions body that still opens with a fence.
   * The library deliberately stays silent while seeding, so run the check
   * once per loaded skill here — otherwise the message would only appear
   * after the user's first keystroke or a rejected Save.
   */
  useEffect(() => {
    if (loadState !== SkillEditorLoadState.Loaded || !loadedValues) return;
    handleValuesChange({
      name: loadedValues.name ?? '',
      description: loadedValues.description ?? '',
      instructions: loadedValues.instructions ?? '',
    });
  }, [loadState, loadedValues, handleValuesChange]);

  // Warn on a full page unload while there are unsaved changes — the
  // in-app Cancel/Back guards below cover in-app navigation.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Reset selection and close any open preview when switching between
  // resources (create <-> edit, or editing a different skill).
  useEffect(() => {
    setSelectedPath(SKILL_MANIFEST_FILE);
    setHasReturnedToManifest(false);
    closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on resource identity only
  }, [isEditMode, skillPath]);

  const navigateAway = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setPendingCancel(true);
      return;
    }
    navigateAway();
  }, [isDirty, navigateAway]);

  /*
   * Back is preview-aware: while a supporting file is selected it is a return
   * to the `SKILL.md` view inside the editor, not a navigation, so it neither
   * resolves `returnUrl` nor raises the unsaved-changes guard. From the
   * manifest view it keeps today's exit behavior.
   */
  const handleBack = useCallback(() => {
    if (!isManifestSelected) {
      setSelectedPath(SKILL_MANIFEST_FILE);
      setHasReturnedToManifest(true);
      return;
    }
    handleCancel();
  }, [isManifestSelected, handleCancel]);

  const handleReloadLatestClick = useCallback(() => {
    setPendingReload(true);
  }, []);

  const confirmReloadLatest = useCallback(() => {
    setPendingReload(false);
    clearConflict();
    retryLoad();
  }, [clearConflict, retryLoad]);

  const labels = useMemo<SkillEditorLabels>(
    () => ({
      ...refinementLabels,
      filesHeading: t(SkillEditorI18nKeys.FilesHeading),
      filesTreeAriaLabel: t(SkillEditorI18nKeys.FilesTreeAriaLabel),
      addUploadLabel: t(SkillEditorI18nKeys.AddUploadLabel),
      removeLabel: t(SkillEditorI18nKeys.RemoveLabel),
      editingFileLabel: t(SkillEditorI18nKeys.EditingFileLabel),
      nameLabel: t(SkillEditorI18nKeys.NameLabel),
      namePlaceholder: t(SkillEditorI18nKeys.NamePlaceholder),
      nameCaption: t(SkillEditorI18nKeys.NameCaption),
      descriptionLabel: t(SkillEditorI18nKeys.DescriptionLabel),
      descriptionPlaceholder: t(SkillEditorI18nKeys.DescriptionPlaceholder),
      instructionsLabel: t(SkillEditorI18nKeys.InstructionsLabel),
      instructionsPlaceholder: t(SkillEditorI18nKeys.InstructionsPlaceholder),
      createLabel: isEditMode
        ? t(SkillEditorI18nKeys.SaveLabel)
        : t(ButtonsI18nKeys.Create),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      retryLabel: t(ButtonsI18nKeys.Retry),
      loadErrorMessage:
        loadState === SkillEditorLoadState.Forbidden
          ? t(SkillEditorI18nKeys.LoadErrorForbidden)
          : loadState === SkillEditorLoadState.NotFound
            ? t(SkillEditorI18nKeys.LoadErrorNotFound)
            : t(SkillEditorI18nKeys.LoadError),
      savingStatusLabel: t(SkillEditorI18nKeys.SavingStatus),
      loadingAriaLabel: t(SkillEditorI18nKeys.LoadingAriaLabel),
      instructionsLoadingAriaLabel: t(
        SkillEditorI18nKeys.InstructionsLoadingAriaLabel,
      ),
      supportingFileNote: t(SkillEditorI18nKeys.SupportingFileNote),
      reloadLatestLabel: t(SkillEditorI18nKeys.ReloadLatestLabel),
      uploadDialogTitle: t(SkillEditorI18nKeys.UploadDialogTitle),
      uploadDialogCloseAriaLabel: t(ButtonsI18nKeys.Close),
      uploadDropZoneLabel: t(SkillEditorI18nKeys.UploadDropZoneLabel),
      uploadDropZoneMobileLabel: t(
        SkillEditorI18nKeys.UploadDropZoneMobileLabel,
      ),
      uploadDropZoneAriaLabel: t(SkillEditorI18nKeys.UploadDropZoneAriaLabel),
      uploadRemoveCandidateLabel: (path) =>
        t(SkillEditorI18nKeys.UploadRemoveCandidateLabel, { path }),
      uploadManifestRowNote: t(SkillEditorI18nKeys.UploadManifestRowNote),
      uploadConfirmLabel: t(ButtonsI18nKeys.Add),
      uploadCancelLabel: t(ButtonsI18nKeys.Cancel),
      uploadBatchErrorAriaPrefix: t(
        SkillEditorI18nKeys.UploadBatchErrorAriaPrefix,
      ),
      dropOverlayTitle: t(SkillEditorI18nKeys.DropOverlayTitle),
      dropOverlaySubtitle: t(SkillEditorI18nKeys.DropOverlaySubtitle),
    }),
    [t, isEditMode, loadState, refinementLabels],
  );

  if (!bucket) {
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <h1 className="dial-h1-text">
          {t(SkillEditorI18nKeys.BucketMissingTitle)}
        </h1>
        <ErrorText text={t(SkillEditorI18nKeys.BucketMissingMessage)} />
        <PrimaryButton
          label={t(ButtonsI18nKeys.Cancel)}
          onClick={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Announces the return to the manifest view; the Back control keeps
          focus across the transition, so nothing else signals the change. */}
      <span role="status" aria-live="polite" className="sr-only">
        {hasReturnedToManifest && isManifestSelected
          ? t(SkillEditorI18nKeys.ReturnedToManifestStatus)
          : ''}
      </span>

      <SkillEditorForm
        key={`${bucket}/${skillPath ?? NEW_SKILL_CANVAS_SCOPE}`}
        onRefineDescription={onRefineDescription}
        onRefineInstructions={onRefineInstructions}
        initialValues={loadedValues}
        files={files}
        selectedPath={selectedPath}
        onSelectedPathChange={handleSelectedPathChange}
        isLoading={loadState === SkillEditorLoadState.Loading}
        hasLoadError={
          loadState === SkillEditorLoadState.Error ||
          loadState === SkillEditorLoadState.Forbidden ||
          loadState === SkillEditorLoadState.NotFound
        }
        isSubmitting={phase === 'submitting'}
        errors={errors}
        submitError={submitError}
        onRetrySubmit={isSubmitErrorRetryable ? retrySubmit : undefined}
        conflict={conflict}
        onReloadLatest={handleReloadLatestClick}
        isNameReadOnly={isEditMode}
        onDirtyChange={setIsDirty}
        onValuesChange={handleValuesChange}
        fileActions={fileActions}
        supportingFileContent={
          <SkillFilePreview state={previewState} onRetry={retryPreview} />
        }
        labels={labels}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onBack={handleBack}
        onRetry={retryLoad}
        backAriaLabel={
          isManifestSelected
            ? t(SkillEditorI18nKeys.BackAriaLabel)
            : t(SkillEditorI18nKeys.BackToManifestAriaLabel)
        }
        title={
          isEditMode
            ? t(SkillEditorI18nKeys.EditTitle)
            : t(SkillEditorI18nKeys.Title)
        }
        instructionsEditorTheme={
          currentTheme === ThemeId.Dark ? EditorThemes.dark : EditorThemes.light
        }
      />

      <ConfirmationPopup
        open={pendingCancel}
        header={t(SkillEditorI18nKeys.UnsavedChangesTitle)}
        description={t(SkillEditorI18nKeys.UnsavedChangesMessage)}
        confirmLabel={t(SkillEditorI18nKeys.UnsavedChangesConfirmLabel)}
        cancelLabel={t(SkillEditorI18nKeys.UnsavedChangesCancelLabel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={() => {
          setPendingCancel(false);
          navigateAway();
        }}
        onCancel={() => setPendingCancel(false)}
        onClose={() => setPendingCancel(false)}
      />

      <ConfirmationPopup
        open={pendingReload}
        header={t(SkillEditorI18nKeys.ReloadConfirmTitle)}
        description={t(SkillEditorI18nKeys.ReloadConfirmMessage)}
        confirmLabel={t(SkillEditorI18nKeys.ReloadConfirmLabel)}
        cancelLabel={t(SkillEditorI18nKeys.ReloadCancelLabel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={confirmReloadLatest}
        onCancel={() => setPendingReload(false)}
        onClose={() => setPendingReload(false)}
      />

      <ConfirmationPopup
        open={pendingManifestImport}
        header={t(SkillEditorI18nKeys.ManifestImportConfirmTitle)}
        description={t(SkillEditorI18nKeys.ManifestImportConfirmMessage)}
        confirmLabel={t(ButtonsI18nKeys.Replace)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={() => resolveManifestImport(true)}
        onCancel={() => resolveManifestImport(false)}
        onClose={() => resolveManifestImport(false)}
      />
    </div>
  );
};

export default memo(SkillEditorPage);
