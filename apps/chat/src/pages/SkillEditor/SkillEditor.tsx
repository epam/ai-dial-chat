import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SkillEditor as SkillEditorForm,
  SkillFileNodeKind,
  type SkillEditorErrors,
  type SkillEditorFileActions,
  type SkillEditorLabels,
  type SkillEditorValues,
  type SkillFileTreeNode,
  type SkillFileUploadCandidate,
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
import { useOpenAttachmentCanvas } from '../../hooks/attachment/useOpenAttachmentCanvas';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../server-api/api-error';
import {
  createSkill,
  downloadSkill,
  updateSkill,
} from '../../server-api/skills.api';
import { EditorQuery } from '../../types/editor-query';
import { ROUTES } from '../../types/routes';
import { ThemeId } from '../../types/theme-id';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  isValidSkillRelativePath,
  normalizeSkillName,
  parseSkillManifest,
  SKILL_MANIFEST_FILE,
  unpackSkillArchive,
} from '../../utils/skill';
import {
  skillFileToAttachment,
  type SkillFileContent,
} from '../../utils/skill-file-preview';
import { getUtf8ByteLength } from '../../utils/string-utils';
import { SkillFilePreview } from './SkillFilePreview';
import type { SkillFileBatchValidationMessages } from './utils/skill-file-batch-validation';
import { validateSkillFileBatch } from './utils/skill-file-batch-validation';

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
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();
  const {
    closeCanvas,
    isOpen: isCanvasOpen,
    isLoading: isCanvasLoading,
    attachmentId: canvasAttachmentId,
  } = useAttachmentCanvas();

  const rawReturnUrl = searchParams.get(EditorQuery.ReturnUrl);
  const returnUrl =
    rawReturnUrl != null && isSafeReturnUrl(rawReturnUrl)
      ? rawReturnUrl
      : ROUTES.Catalog;

  const bucket = user?.bucket;

  const rawId = searchParams.get(EditorQuery.Id);
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
  const filesContentRef = useRef<Map<string, SkillFileContent>>(new Map());
  const lastAttemptRef = useRef<LastAttempt | null>(null);
  const [selectedPath, setSelectedPath] = useState(SKILL_MANIFEST_FILE);

  const [errors, setErrors] = useState<SkillEditorErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<{ message: string } | undefined>();
  const [phase, setPhase] = useState<SubmitPhase>('idle');

  const [isDirty, setIsDirty] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingReload, setPendingReload] = useState(false);
  const [pendingManifestImport, setPendingManifestImport] = useState(false);
  const manifestImportResolveRef = useRef<((accepted: boolean) => void) | null>(
    null,
  );

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
        filesContentRef.current = new Map(
          [...unpackedFiles].map(([path, bytes]) => [path, { bytes }]),
        );
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

  // Reset selection and close any open preview when switching between
  // resources (create <-> edit, or editing a different skill).
  useEffect(() => {
    setSelectedPath(SKILL_MANIFEST_FILE);
    closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on resource identity only
  }, [isEditMode, skillPath]);

  // Reconciles the attachment canvas with the current file-tree selection:
  // opens/replaces the preview for a selected supporting file, closes it for
  // SKILL.md/a folder, and self-corrects if a slower-resolving earlier
  // selection's content lands after a newer selection already committed.
  useEffect(() => {
    if (selectedPath === SKILL_MANIFEST_FILE) {
      if (isCanvasOpen) closeCanvas();
      return;
    }
    const node = files.find(
      (file) =>
        file.path === selectedPath && file.kind === SkillFileNodeKind.File,
    );
    if (!node) {
      if (isCanvasOpen) closeCanvas();
      return;
    }
    if (
      canvasAttachmentId === selectedPath &&
      (isCanvasLoading || isCanvasOpen)
    ) {
      return;
    }
    const content = filesContentRef.current.get(node.path);
    if (!content) return;

    void openAttachmentCanvas(skillFileToAttachment(node, content), node.path);
  }, [
    selectedPath,
    files,
    canvasAttachmentId,
    isCanvasLoading,
    isCanvasOpen,
    closeCanvas,
    openAttachmentCanvas,
  ]);

  // Close any open preview when leaving the Skill Editor.
  useEffect(() => {
    return () => closeCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

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

  const batchValidationMessages = useMemo<SkillFileBatchValidationMessages>(
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
    }),
    [t],
  );

  /*
   * The live in-progress name/description/instructions the user is typing
   * live only inside `libs/skill-editor`'s internal form state — this page
   * only ever sees them via `onSubmit`. `loadedValues` (the seeded baseline)
   * is therefore the closest available approximation of "the current
   * manifest" for the projected-total-size check; the BFF remains the
   * authoritative gate regardless of this estimate's precision.
   */
  const buildBatchValidationContext = useCallback(() => {
    const existingPaths = files
      .filter((node) => node.kind === SkillFileNodeKind.File)
      .map((node) => node.path);
    let existingTotalBytes = 0;
    for (const path of existingPaths) {
      existingTotalBytes +=
        filesContentRef.current.get(path)?.bytes.length ?? 0;
    }
    const baseline = {
      name: loadedValues?.name ?? '',
      description: loadedValues?.description ?? '',
      instructions: loadedValues?.instructions ?? '',
    };
    const manifestText = isEditMode
      ? buildSkillManifestFromFrontmatter(
          frontmatterRef.current,
          baseline.name,
          baseline.description,
          baseline.instructions,
        )
      : buildSkillManifest(baseline);
    return {
      existingPaths,
      existingTotalBytes,
      manifestByteLength: getUtf8ByteLength(manifestText),
      messages: batchValidationMessages,
    };
  }, [files, isEditMode, loadedValues, batchValidationMessages]);

  const confirmManifestImport = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      manifestImportResolveRef.current = resolve;
      setPendingManifestImport(true);
    });
  }, []);

  const fileActions = useMemo<SkillEditorFileActions>(
    () => ({
      validateBatch: async (candidates: SkillFileUploadCandidate[]) => {
        const { results, batchErrors } = await validateSkillFileBatch(
          candidates,
          buildBatchValidationContext(),
        );
        return { results, batchErrors };
      },
      commitBatch: async (candidates: SkillFileUploadCandidate[]) => {
        const { results, batchErrors, manifestCandidate } =
          await validateSkillFileBatch(
            candidates,
            buildBatchValidationContext(),
          );
        const hasInvalid = results.some((result) => result.error !== undefined);
        if (hasInvalid || batchErrors.length > 0) {
          return {
            error: batchErrors[0]?.message ?? t(SkillEditorI18nKeys.ErrorSave),
          };
        }

        if (manifestCandidate) {
          if (
            isEditMode &&
            manifestCandidate.name !== (loadedValues?.name ?? '')
          ) {
            return { error: t(SkillEditorI18nKeys.ErrorManifestNameMismatch) };
          }
          if (isEditMode || isDirty) {
            const accepted = await confirmManifestImport();
            if (!accepted) {
              return {
                error: t(SkillEditorI18nKeys.ManifestImportCancelLabel),
              };
            }
          }
        }

        try {
          const supportingCandidates = candidates.filter(
            (candidate) => candidate.id !== manifestCandidate?.candidateId,
          );
          const reads = await Promise.all(
            supportingCandidates.map(async (candidate) => ({
              path: candidate.path,
              bytes: new Uint8Array(await candidate.file.arrayBuffer()),
              mimeType: candidate.file.type || undefined,
            })),
          );

          for (const read of reads) {
            filesContentRef.current.set(read.path, {
              bytes: read.bytes,
              mimeType: read.mimeType,
            });
          }
          if (reads.length > 0) {
            setFiles((prev) => [
              ...prev,
              ...reads.map((read) => ({
                path: read.path,
                name: nameFromPath(read.path),
                kind: SkillFileNodeKind.File,
              })),
            ]);
          }

          if (manifestCandidate) {
            frontmatterRef.current = isEditMode
              ? { ...frontmatterRef.current, ...manifestCandidate.frontmatter }
              : manifestCandidate.frontmatter;
            setLoadedValues({
              name: isEditMode
                ? (loadedValues?.name ?? manifestCandidate.name)
                : manifestCandidate.name,
              description: manifestCandidate.description,
              instructions: manifestCandidate.instructions,
            });
          }

          return {};
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
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
        setSelectedPath((prev) =>
          prev === path || prev.startsWith(`${path}/`)
            ? SKILL_MANIFEST_FILE
            : prev,
        );
      },
    }),
    [
      buildBatchValidationContext,
      isEditMode,
      isDirty,
      loadedValues,
      confirmManifestImport,
      t,
    ],
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
        /*
         * A dropped SKILL.md's unknown frontmatter fields (e.g. `version`)
         * are preserved by merging into the imported frontmatter object
         * rather than always building a fresh one — `frontmatterRef` stays
         * `{}` unless a manifest was imported in this create session.
         */
        skillManifest =
          Object.keys(frontmatterRef.current).length > 0
            ? buildSkillManifestFromFrontmatter(
                frontmatterRef.current,
                normalizedName,
                values.description,
                values.instructions,
              )
            : buildSkillManifest({
                name: normalizedName,
                description: values.description,
                instructions: values.instructions,
              });
        const fileNodes = files.filter(
          (node) => node.kind === SkillFileNodeKind.File,
        );
        filePaths = fileNodes.map((node) => node.path);
        fileBlobs = fileNodes.map((node) =>
          toBlob(
            filesContentRef.current.get(node.path)?.bytes ?? new Uint8Array(0),
          ),
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
        toBlob(
          filesContentRef.current.get(node.path)?.bytes ?? new Uint8Array(0),
        ),
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
      instructionsLoadingAriaLabel: t(
        SkillEditorI18nKeys.InstructionsLoadingAriaLabel,
      ),
      supportingFileNote: t(SkillEditorI18nKeys.SupportingFileNote),
      reloadLatestLabel: t(SkillEditorI18nKeys.ReloadLatestLabel),
      uploadDialogTitle: t(SkillEditorI18nKeys.UploadDialogTitle),
      uploadDialogCloseAriaLabel: t(
        SkillEditorI18nKeys.UploadDialogCloseAriaLabel,
      ),
      uploadDropZoneLabel: t(SkillEditorI18nKeys.UploadDropZoneLabel),
      uploadDropZoneMobileLabel: t(
        SkillEditorI18nKeys.UploadDropZoneMobileLabel,
      ),
      uploadDropZoneAriaLabel: t(SkillEditorI18nKeys.UploadDropZoneAriaLabel),
      uploadRemoveCandidateLabel: (path) =>
        t(SkillEditorI18nKeys.UploadRemoveCandidateLabel, { path }),
      uploadManifestRowNote: t(SkillEditorI18nKeys.UploadManifestRowNote),
      uploadConfirmLabel: t(SkillEditorI18nKeys.UploadConfirmLabel),
      uploadCancelLabel: t(SkillEditorI18nKeys.UploadCancelLabel),
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
          supportingFileContent={<SkillFilePreview path={selectedPath} />}
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

      <ConfirmationPopup
        open={pendingManifestImport}
        header={t(SkillEditorI18nKeys.ManifestImportConfirmTitle)}
        description={t(SkillEditorI18nKeys.ManifestImportConfirmMessage)}
        confirmLabel={t(SkillEditorI18nKeys.ManifestImportConfirmLabel)}
        cancelLabel={t(SkillEditorI18nKeys.ManifestImportCancelLabel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={() => {
          setPendingManifestImport(false);
          manifestImportResolveRef.current?.(true);
          manifestImportResolveRef.current = null;
        }}
        onCancel={() => {
          setPendingManifestImport(false);
          manifestImportResolveRef.current?.(false);
          manifestImportResolveRef.current = null;
        }}
        onClose={() => {
          setPendingManifestImport(false);
          manifestImportResolveRef.current?.(false);
          manifestImportResolveRef.current = null;
        }}
      />
    </div>
  );
};

export default memo(SkillEditorPage);
