import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SkillEditor as SkillEditorForm,
  type SkillEditorLabels,
} from '@epam/ai-dial-skill-editor';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  EditorThemes,
  ErrorText,
  GhostIconButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { isSafeReturnUrl } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useSkills } from '../../context/SkillsContext';
import { useTheme } from '../../context/ThemeContext';
import { EditorQuery } from '../../types/editor-query';
import { ROUTES } from '../../types/routes';
import { parseSkillResourceUrl, PUBLIC_SKILL_BUCKET } from '../../types/skill';
import { SkillEditorLoadState } from '../../types/skill-editor-load-state';
import { ThemeId } from '../../types/theme-id';
import {
  isValidSkillRelativePath,
  SKILL_MANIFEST_FILE,
} from '../../utils/skill';
import { useSkillEditorLoad } from './hooks/useSkillEditorLoad';
import { useSkillEditorSubmit } from './hooks/useSkillEditorSubmit';
import { useSkillFileActions } from './hooks/useSkillFileActions';
import { useSkillFilePreviewSync } from './hooks/useSkillFilePreviewSync';
import { SkillFilePreview } from './SkillFilePreview';

const SkillEditorPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { refetchSkills } = useSkills();
  const { currentTheme } = useTheme();
  const { closeCanvas } = useAttachmentCanvas();

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
  } = useSkillEditorLoad({ isEditMode, bucket, skillPath });

  const [selectedPath, setSelectedPath] = useState(SKILL_MANIFEST_FILE);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);

  useSkillFilePreviewSync({ selectedPath, files, filesContentRef });

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
    });

  const { phase, errors, submitError, conflict, clearConflict, handleSubmit } =
    useSkillEditorSubmit({
      bucket,
      isEditMode,
      files,
      filesContentRef,
      frontmatterRef,
      loadedPathRef,
      etagRef,
      returnUrl,
      refetchSkills,
    });

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
      filesHeading: t(SkillEditorI18nKeys.FilesHeading),
      filesTreeAriaLabel: t(SkillEditorI18nKeys.FilesTreeAriaLabel),
      addUploadLabel: t(SkillEditorI18nKeys.AddUploadLabel),
      removeLabel: t(SkillEditorI18nKeys.RemoveLabel),
      removeConfirmTitle: t(SkillEditorI18nKeys.RemoveConfirmTitle),
      removeConfirmMessage: (path) =>
        t(SkillEditorI18nKeys.RemoveConfirmMessage, { path }),
      removeConfirmLabel: t(SkillEditorI18nKeys.RemoveConfirmLabel),
      removeCancelLabel: t(SkillEditorI18nKeys.RemoveCancelLabel),
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
    [t, isEditMode, loadState],
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

  const headerRow = (
    <>
      <GhostIconButton
        icon={
          <IconArrowLeft size={20} className="rtl:scale-x-[-1]" aria-hidden />
        }
        aria-label={t(SkillEditorI18nKeys.BackAriaLabel)}
        onClick={handleCancel}
      />
      <h1 className={mergeClasses('dial-h2-text')}>
        {isEditMode
          ? t(SkillEditorI18nKeys.EditTitle)
          : t(SkillEditorI18nKeys.Title)}
      </h1>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-tertiary p-4 desktop:hidden">
        {headerRow}
      </div>
      <div className="min-h-0 flex-1">
        <SkillEditorForm
          initialValues={loadedValues}
          files={files}
          selectedPath={selectedPath}
          onSelectedPathChange={setSelectedPath}
          isLoading={loadState === SkillEditorLoadState.Loading}
          hasLoadError={
            loadState === SkillEditorLoadState.Error ||
            loadState === SkillEditorLoadState.Forbidden ||
            loadState === SkillEditorLoadState.NotFound
          }
          isSubmitting={phase === 'submitting'}
          errors={errors}
          submitError={submitError}
          conflict={conflict}
          onReloadLatest={handleReloadLatestClick}
          isNameReadOnly={isEditMode}
          onDirtyChange={setIsDirty}
          fileActions={fileActions}
          headerContent={headerRow}
          supportingFileContent={<SkillFilePreview path={selectedPath} />}
          labels={labels}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onRetry={retryLoad}
          instructionsEditorTheme={
            currentTheme === ThemeId.Dark
              ? EditorThemes.dark
              : EditorThemes.light
          }
        />
      </div>

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
