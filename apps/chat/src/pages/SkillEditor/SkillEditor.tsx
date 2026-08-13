import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SkillEditor as SkillEditorForm,
  SkillFileNodeKind,
  type SkillEditorErrors,
  type SkillEditorFileActions,
  type SkillEditorLabels,
  type SkillEditorValues,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  ErrorText,
  GhostIconButton,
  NotificationVariant,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { isSafeReturnUrl } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../server-api/api-error';
import {
  createSkill,
  downloadSkill,
  updateSkill,
} from '../../server-api/skills.api';
import { ROUTES } from '../../types/routes';
import { SkillEditorQuery } from '../../types/skill-editor';
import { ThemeId } from '../../types/theme-id';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  isValidSkillRelativePath,
  normalizeSkillName,
  parseSkillManifest,
  SKILL_FILE_UPLOAD_MAX_BYTES,
  unpackSkillArchive,
} from '../../utils/skill';
import { formatFileSize } from '../../utils/string-utils';

/*
 * Phase names collapse the tasks.md-specified `initial`/`dirty` distinction
 * into a single `idle` phase for submit purposes — dirty tracking for
 * navigation guards is handled separately via `isDirty` (from the library's
 * `onDirtyChange`), not folded into this enum.
 */
type SubmitPhase = 'idle' | 'submitting' | 'success' | 'failure';

/** Edit-mode load state; create mode never leaves `'loaded'`. */
type LoadState = 'loading' | 'loaded' | 'error' | 'forbidden' | 'not-found';

const nameFromPath = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

const toBlob = (bytes: Uint8Array): Blob => new Blob([new Uint8Array(bytes)]);

/*
 * Fingerprints the in-memory package (form values + supporting-file paths) so
 * a retried submission after a 503 resubmits the exact same request payload
 * rather than re-deriving it from (possibly since-edited) current form state.
 */
const fingerprintAttempt = (
  values: SkillEditorValues,
  files: SkillFileTreeNode[],
): string =>
  JSON.stringify({
    values,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  });

interface LastAttempt {
  fingerprint: string;
  bucket: string;
  path: string;
  skillManifest: string;
  filePaths: string[];
  files: Blob[];
}

const SkillEditorPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const { showNotification } = useNotification();

  const rawReturnUrl = searchParams.get(SkillEditorQuery.ReturnUrl);
  const returnUrl =
    rawReturnUrl != null && isSafeReturnUrl(rawReturnUrl)
      ? rawReturnUrl
      : ROUTES.Catalog;

  const bucket = user?.bucket;

  const rawId = searchParams.get(SkillEditorQuery.Id);
  const isEditMode = rawId != null && rawId !== '';
  /*
   * A skill's `id` is its relative path within the *current user's own*
   * bucket — there is no Catalog entry point yet to reach another user's
   * shared skill (see design.md Non-Goals), so bucket is always the current
   * user's, never decoded from `id`.
   */
  const skillPath = useMemo(() => {
    if (!isEditMode) return undefined;
    try {
      const decoded = decodeURIComponent(rawId);
      return isValidSkillRelativePath(decoded) ? decoded : null;
    } catch {
      return null;
    }
  }, [isEditMode, rawId]);

  const [loadState, setLoadState] = useState<LoadState>(
    isEditMode ? 'loading' : 'loaded',
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedValues, setLoadedValues] = useState<
    SkillEditorValues | undefined
  >();
  const etagRef = useRef<string | undefined>(undefined);
  const frontmatterRef = useRef<Record<string, unknown>>({});
  const loadedPathRef = useRef<string | undefined>(undefined);

  const [files, setFiles] = useState<SkillFileTreeNode[]>([]);
  const filesContentRef = useRef<Map<string, Uint8Array>>(new Map());
  const lastAttemptRef = useRef<LastAttempt | null>(null);

  const [errors, setErrors] = useState<SkillEditorErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<{ message: string } | undefined>();
  const [phase, setPhase] = useState<SubmitPhase>('idle');

  const [isDirty, setIsDirty] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);

  // Edit-mode load.
  useEffect(() => {
    if (!isEditMode || !bucket) return;
    if (skillPath == null) {
      setLoadState('error');
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    (async () => {
      try {
        const response = await downloadSkill(bucket, skillPath);
        const etag = response.headers.get('etag');
        if (!etag) {
          if (!cancelled) setLoadState('error');
          return;
        }
        const buffer = await response.arrayBuffer();
        const { manifestText, files: unpackedFiles } = unpackSkillArchive(
          new Uint8Array(buffer),
        );
        const { frontmatter, instructions } = parseSkillManifest(manifestText);
        if (cancelled) return;

        etagRef.current = etag;
        frontmatterRef.current = frontmatter;
        loadedPathRef.current = skillPath;
        filesContentRef.current = unpackedFiles;
        setFiles(
          [...unpackedFiles.keys()].map((path) => ({
            path,
            name: nameFromPath(path),
            kind: SkillFileNodeKind.File,
          })),
        );
        setLoadedValues({
          name: typeof frontmatter.name === 'string' ? frontmatter.name : '',
          description:
            typeof frontmatter.description === 'string'
              ? frontmatter.description
              : '',
          instructions,
        });
        setLoadState('loaded');
      } catch (err) {
        if (cancelled) return;
        const status = getApiErrorStatus(err);
        if (status === 403) setLoadState('forbidden');
        else if (status === 404) setLoadState('not-found');
        else setLoadState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, bucket, skillPath, loadAttempt]);

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

  const handleRetryLoad = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

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
    setConflict(undefined);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const validatePath = useCallback(
    (path: string): string | undefined => {
      if (!path) return t(SkillEditorI18nKeys.ErrorRequired);
      if (path === 'SKILL.md') {
        return t(SkillEditorI18nKeys.ErrorPathReserved);
      }
      if (!isValidSkillRelativePath(path)) {
        return t(SkillEditorI18nKeys.ErrorPathInvalid);
      }
      if (files.some((node) => node.path === path)) {
        return t(SkillEditorI18nKeys.ErrorPathDuplicate);
      }
      return undefined;
    },
    [files, t],
  );

  const fileActions = useMemo<SkillEditorFileActions>(
    () => ({
      validatePath,
      onUploadFile: async (file, path) => {
        if (file.size > SKILL_FILE_UPLOAD_MAX_BYTES) {
          showNotification({
            variant: NotificationVariant.Error,
            message: t(SkillEditorI18nKeys.ErrorFileTooLarge, {
              maxSize: formatFileSize(SKILL_FILE_UPLOAD_MAX_BYTES),
            }),
          });
          return;
        }
        const buffer = await file.arrayBuffer();
        filesContentRef.current.set(path, new Uint8Array(buffer));
        setFiles((prev) => [
          ...prev,
          { path, name: nameFromPath(path), kind: SkillFileNodeKind.File },
        ]);
      },
      onRemoveNode: (path) => {
        setFiles((prev) =>
          prev.filter(
            (node) => node.path !== path && !node.path.startsWith(`${path}/`),
          ),
        );
        for (const key of [...filesContentRef.current.keys()]) {
          if (key === path || key.startsWith(`${path}/`)) {
            filesContentRef.current.delete(key);
          }
        }
      },
    }),
    [validatePath, t, showNotification],
  );

  const applyUploadErrorStatus = useCallback(
    async (err: unknown) => {
      const status = getApiErrorStatus(err);
      switch (status) {
        case 409:
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        case 412:
          /*
           * In edit mode this is a genuine stale-edit conflict, handled
           * separately by `handleSubmit` before this function is ever
           * called. In create mode it is unreachable (create never sends
           * `If-Match`) — treated defensively the same as `409` should it
           * ever occur, which would indicate an unexpected upstream change.
           */
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        case 413:
          setSubmitError(t(SkillEditorI18nKeys.ErrorArchiveTooLarge));
          return;
        case 503:
          setSubmitError(t(SkillEditorI18nKeys.ErrorServiceUnavailable));
          return;
        case 400: {
          /*
           * A 400 has no single fixed cause (bad archive, rejected manifest
           * field, upstream request-shape issue, ...) — show the BFF's own
           * message (which now forwards DIAL Core's `upstreamMessage`)
           * instead of a fixed, potentially misleading guess.
           */
          const { message } = await getApiErrorDetails(err);
          setSubmitError(message ?? t(SkillEditorI18nKeys.ErrorPathInvalid));
          return;
        }
        default: {
          const { traceId } = await getApiErrorDetails(err);
          setSubmitError(t(SkillEditorI18nKeys.ErrorSave));
          showNotification({
            variant: NotificationVariant.Error,
            message: t(SkillEditorI18nKeys.ErrorSave),
            requestId: traceId,
          });
        }
      }
    },
    [showNotification, t],
  );

  const handleSubmitCreate = useCallback(
    async (values: SkillEditorValues) => {
      const normalizedName = normalizeSkillName(values.name);
      if (!normalizedName || !isValidSkillRelativePath(normalizedName)) {
        setErrors({ name: t(SkillEditorI18nKeys.ErrorNameInvalid) });
        return;
      }

      const fingerprint = fingerprintAttempt(values, files);
      const cached = lastAttemptRef.current;
      const canReuse = cached != null && cached.fingerprint === fingerprint;

      const path = normalizedName;
      let skillManifest: string;
      let filePaths: string[];
      let fileBlobs: Blob[];
      if (canReuse) {
        ({ skillManifest, filePaths, files: fileBlobs } = cached);
      } else {
        skillManifest = buildSkillManifest({
          name: normalizedName,
          description: values.description,
          instructions: values.instructions,
        });
        const fileNodes = files.filter(
          (node) => node.kind === SkillFileNodeKind.File,
        );
        filePaths = fileNodes.map((node) => node.path);
        fileBlobs = fileNodes.map((node) =>
          toBlob(filesContentRef.current.get(node.path) ?? new Uint8Array(0)),
        );
      }

      setPhase('submitting');
      lastAttemptRef.current = {
        fingerprint,
        bucket: bucket as string,
        path,
        skillManifest,
        filePaths,
        files: fileBlobs,
      };

      try {
        await createSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
        );

        setPhase('success');
        showNotification({
          variant: NotificationVariant.Success,
          title: t(SkillEditorI18nKeys.SaveSuccessTitle),
          message: t(SkillEditorI18nKeys.CreateSuccess, {
            name: normalizedName,
          }),
        });
        navigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      t,
      showNotification,
      navigate,
      returnUrl,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmitEdit = useCallback(
    async (values: SkillEditorValues) => {
      const path = loadedPathRef.current;
      const etag = etagRef.current;
      if (!path || !etag) {
        setSubmitError(t(SkillEditorI18nKeys.ErrorSave));
        return;
      }

      const skillManifest = buildSkillManifestFromFrontmatter(
        frontmatterRef.current,
        values.name,
        values.description,
        values.instructions,
      );
      const fileNodes = files.filter(
        (node) => node.kind === SkillFileNodeKind.File,
      );
      const filePaths = fileNodes.map((node) => node.path);
      const fileBlobs = fileNodes.map((node) =>
        toBlob(filesContentRef.current.get(node.path) ?? new Uint8Array(0)),
      );

      setPhase('submitting');
      try {
        const result = await updateSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
          etag,
        );
        etagRef.current = result.etag ?? etag;

        setPhase('success');
        showNotification({
          variant: NotificationVariant.Success,
          title: t(SkillEditorI18nKeys.SaveSuccessTitle),
          message: t(SkillEditorI18nKeys.UpdateSuccess, {
            name: values.name,
          }),
        });
        navigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        const status = getApiErrorStatus(err);
        if (status === 412) {
          setConflict({ message: t(SkillEditorI18nKeys.ConflictMessage) });
          return;
        }
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      t,
      showNotification,
      navigate,
      returnUrl,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmit = useCallback(
    async (values: SkillEditorValues) => {
      if (phase === 'submitting' || !bucket) return;

      const nextErrors: SkillEditorErrors = {};
      if (!values.name.trim())
        nextErrors.name = t(SkillEditorI18nKeys.ErrorRequired);
      if (!values.description.trim()) {
        nextErrors.description = t(SkillEditorI18nKeys.ErrorRequired);
      }
      if (!values.instructions.trim()) {
        nextErrors.instructions = t(SkillEditorI18nKeys.ErrorRequired);
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setErrors({});
      setSubmitError(undefined);
      setConflict(undefined);

      if (isEditMode) {
        await handleSubmitEdit(values);
      } else {
        await handleSubmitCreate(values);
      }
    },
    [phase, bucket, t, isEditMode, handleSubmitEdit, handleSubmitCreate],
  );

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
        loadState === 'forbidden'
          ? t(SkillEditorI18nKeys.LoadErrorForbidden)
          : loadState === 'not-found'
            ? t(SkillEditorI18nKeys.LoadErrorNotFound)
            : t(SkillEditorI18nKeys.LoadError),
      savingStatusLabel: t(SkillEditorI18nKeys.SavingStatus),
      loadingAriaLabel: t(SkillEditorI18nKeys.LoadingAriaLabel),
      supportingFileNote: t(SkillEditorI18nKeys.SupportingFileNote),
      reloadLatestLabel: t(SkillEditorI18nKeys.ReloadLatestLabel),
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
          initialValues={isEditMode ? loadedValues : undefined}
          files={files}
          isLoading={loadState === 'loading'}
          hasLoadError={
            loadState === 'error' ||
            loadState === 'forbidden' ||
            loadState === 'not-found'
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
          labels={labels}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onRetry={handleRetryLoad}
          instructionsEditorTheme={
            currentTheme === ThemeId.Dark ? 'dark' : 'light'
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
    </div>
  );
};

export default memo(SkillEditorPage);
