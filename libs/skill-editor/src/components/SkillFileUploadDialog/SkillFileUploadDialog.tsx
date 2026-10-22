import { formatFileSize, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  ErrorText,
  FileDropzone,
  GhostIconButton,
  RadioGroup,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconFileText, IconTrashX } from '@tabler/icons-react';
import type { FC } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  SkillEditorFileActions,
  SkillEditorLabels,
  SkillFileSourceEntry,
  SkillFileUploadCandidate,
  SkillFileValidationResult,
} from '../../models/skill-editor-props';
import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
} from '../../models/skill-editor-props';
import { SKILL_MANIFEST_PATH } from '../../types/skill-editor-defaults';
import { SkillFileConflictResolution } from '../../types/skill-file-conflict-resolution';
import { SkillFileUploadMode } from '../../types/skill-file-upload-mode';
import { resolveCandidatePath } from '../../utils/candidate-path';
import { buildDuplicatePath, joinSkillPath } from '../../utils/file-tree';
import { SkillEditorDialog } from '../SkillEditorDialog/SkillEditorDialog';

/** Props for `SkillFileUploadDialog`. */
export interface SkillFileUploadDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Called to close the dialog (Escape, close control, Cancel, or a successful commit). */
  onClose: () => void;
  /** Batch validation/commit operations, host-owned. */
  fileActions: Pick<
    SkillEditorFileActions,
    'validateBatch' | 'commitBatch' | 'extractArchive'
  >;
  /** Whether picked/dropped files are staged as-is or expanded as `.zip` archives. Defaults to `SkillFileUploadMode.Files`. */
  mode?: SkillFileUploadMode;
  /** Folder every staged path is placed under; `''` is the skill root. Defaults to `''`. */
  targetFolderPath?: string;
  /** Host-supplied entries (e.g. a file-system pick) to stage when the dialog opens. Read once per open transition. */
  initialEntries?: SkillFileSourceEntry[];
  /**
   * Files to stage immediately when the dialog opens (e.g. files dropped
   * outside the dialog before it was open). Read once per open transition.
   */
  initialFiles?: File[];
  /** Paths of the supporting files already in the skill; an upload to one of them first asks whether to replace or duplicate it. Defaults to `[]`. */
  existingFilePaths?: string[];
  /** Called with the committed batch after `commitBatch` succeeds, before the dialog closes. */
  onCommitted?: (candidates: SkillFileUploadCandidate[]) => void;
  /** Typography class of the Replace-or-duplicate message. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
  /** Typography and color classes of a staged row's size and notes. Defaults to `'dial-tiny-text text-secondary'`. */
  rowCaptionClassName?: string;
  /** Text overrides. */
  labels?: SkillEditorLabels;
}

const ARCHIVE_ACCEPT = '.zip,application/zip';
const NO_EXISTING_FILE_PATHS: string[] = [];

let candidateSeq = 0;
const nextCandidateId = (): string => `skill-file-candidate-${++candidateSeq}`;

const toCandidate = (
  file: File,
  path: string,
  targetFolderPath: string,
): SkillFileUploadCandidate => ({
  id: nextCandidateId(),
  file,
  path: joinSkillPath(targetFolderPath, path.replace(/\\/g, '/')),
});

/**
 * Upload dialog offering drag-and-drop and click-to-browse multi-file
 * staging, with per-row validation feedback and an atomic batch commit.
 */
export const SkillFileUploadDialog: FC<SkillFileUploadDialogProps> = ({
  isOpen,
  onClose,
  fileActions,
  mode = SkillFileUploadMode.Files,
  targetFolderPath = '',
  initialFiles,
  initialEntries,
  existingFilePaths = NO_EXISTING_FILE_PATHS,
  onCommitted,
  messageClassName = 'dial-small-text',
  rowCaptionClassName = 'dial-tiny-text text-secondary',
  labels,
}) => {
  const t = labels ?? {};
  const [candidates, setCandidates] = useState<SkillFileUploadCandidate[]>([]);
  /* Uploads whose path already holds a file wait here, one question at a time, before they are staged. */
  const [pendingConflicts, setPendingConflicts] = useState<
    SkillFileUploadCandidate[]
  >([]);
  const [conflictResolution, setConflictResolution] = useState(
    SkillFileConflictResolution.Replace,
  );
  const existingPathSet = useMemo(
    () => new Set(existingFilePaths),
    [existingFilePaths],
  );
  const [results, setResults] = useState<
    Map<string, SkillFileValidationResult>
  >(new Map());
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [commitError, setCommitError] = useState<string | undefined>();
  const [isCommitting, setIsCommitting] = useState(false);
  const [sourceError, setSourceError] = useState<string | undefined>();
  const [pendingExtractions, setPendingExtractions] = useState(0);
  /* Bumped on every open so an extraction settling after a close/reopen is dropped. */
  const openGenerationRef = useRef(0);
  const isArchiveMode = mode === SkillFileUploadMode.Archive;
  const archiveErrorMessage =
    t.uploadArchiveErrorMessage ?? "Couldn't read this archive";

  const liveRegionId = useId();
  const dropzoneInputId = useId();
  const conflictMessageRef = useRef<HTMLParagraphElement>(null);
  const hasShownConflictRef = useRef(false);
  const activeConflictId = pendingConflicts[0]?.id;

  /*
   * The two steps swap the dialog's whole body, so the focused control is
   * unmounted each time: land on the question when it appears (reading it
   * out), and back on the drop zone once the last one is answered.
   */
  useEffect(() => {
    if (!isOpen) return;
    if (activeConflictId != null) {
      hasShownConflictRef.current = true;
      conflictMessageRef.current?.focus();
      return;
    }
    if (hasShownConflictRef.current) {
      hasShownConflictRef.current = false;
      document.getElementById(dropzoneInputId)?.focus();
    }
  }, [activeConflictId, isOpen, dropzoneInputId]);

  /* The root manifest always exists; staging another one is a metadata import, not a file conflict. */
  const isConflicting = (candidate: SkillFileUploadCandidate) =>
    candidate.path !== SKILL_MANIFEST_PATH &&
    existingPathSet.has(candidate.path);

  const stageCandidates = (next: SkillFileUploadCandidate[]) => {
    setCommitError(undefined);
    setCandidates((prev) => [
      ...prev,
      ...next.filter((candidate) => !isConflicting(candidate)),
    ]);
    setPendingConflicts((prev) => [...prev, ...next.filter(isConflicting)]);
  };

  /* `null` drops the conflicting upload. */
  const resolveConflict = (resolution: SkillFileConflictResolution | null) => {
    const [conflict, ...rest] = pendingConflicts;
    if (!conflict) return;
    setPendingConflicts(rest);
    setConflictResolution(SkillFileConflictResolution.Replace);
    if (resolution == null) return;
    setCommitError(undefined);
    setCandidates((prev) => {
      if (resolution === SkillFileConflictResolution.Replace) {
        return [...prev, { ...conflict, replacesExisting: true }];
      }
      const takenPaths = new Set([
        ...existingFilePaths,
        ...prev.map((candidate) => candidate.path),
        ...rest.map((candidate) => candidate.path),
      ]);
      return [
        ...prev,
        { ...conflict, path: buildDuplicatePath(conflict.path, takenPaths) },
      ];
    });
  };

  const extractArchives = async (archives: File[]) => {
    const { extractArchive } = fileActions;
    if (!extractArchive) return;
    const generation = openGenerationRef.current;
    setSourceError(undefined);
    setPendingExtractions((count) => count + 1);
    try {
      const extracted = await Promise.all(
        archives.map((archive) => extractArchive(archive)),
      );
      if (generation !== openGenerationRef.current) return;
      const entries = extracted.flat();
      if (entries.length === 0) {
        setSourceError(
          t.uploadArchiveEmptyMessage ?? 'This archive has no files',
        );
        return;
      }
      stageCandidates(
        entries.map((entry) =>
          toCandidate(entry.file, entry.path, targetFolderPath),
        ),
      );
    } catch {
      if (generation !== openGenerationRef.current) return;
      setSourceError(archiveErrorMessage);
    } finally {
      if (generation === openGenerationRef.current) {
        setPendingExtractions((count) => count - 1);
      }
    }
  };

  const addFiles = (files: File[]) => {
    if (isArchiveMode) {
      void extractArchives(files);
      return;
    }
    stageCandidates(
      files.map((file) =>
        toCandidate(file, resolveCandidatePath(file), targetFolderPath),
      ),
    );
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
  };

  // Reset all staged state whenever the dialog transitions closed -> open,
  // immediately staging any files it was opened with (e.g. dropped before
  // the dialog itself was open).
  useEffect(() => {
    if (!isOpen) return;
    openGenerationRef.current += 1;
    const initialCandidates = [
      ...(initialFiles ?? []).map((file) =>
        toCandidate(file, resolveCandidatePath(file), targetFolderPath),
      ),
      ...(initialEntries ?? []).map((entry) =>
        toCandidate(entry.file, entry.path, targetFolderPath),
      ),
    ];
    setCandidates(
      initialCandidates.filter((candidate) => !isConflicting(candidate)),
    );
    setPendingConflicts(initialCandidates.filter(isConflicting));
    setConflictResolution(SkillFileConflictResolution.Replace);
    setResults(new Map());
    setBatchErrors([]);
    setCommitError(undefined);
    setSourceError(undefined);
    setPendingExtractions(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per open transition, not on every initialFiles/initialEntries identity change
  }, [isOpen]);

  // Re-validate the whole staged batch on every add/remove.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    if (candidates.length === 0) {
      setResults(new Map());
      setBatchErrors([]);
      return;
    }
    setIsValidating(true);
    fileActions
      .validateBatch(candidates)
      .then(({ results: nextResults, batchErrors: nextBatchErrors }) => {
        if (cancelled) return;
        setResults(new Map(nextResults.map((r) => [r.candidateId, r])));
        setBatchErrors(nextBatchErrors.map((e) => e.message));
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the staged id list identity, not fileActions
  }, [candidates, isOpen]);

  const hasInvalidCandidate = candidates.some(
    (candidate) =>
      results.get(candidate.id)?.status === SkillFileValidationStatus.Invalid,
  );
  const isAllInvalid =
    candidates.length > 0 &&
    candidates.every(
      (candidate) =>
        results.get(candidate.id)?.status === SkillFileValidationStatus.Invalid,
    );
  const canConfirm =
    candidates.length > 0 &&
    !hasInvalidCandidate &&
    batchErrors.length === 0 &&
    !isValidating &&
    !isCommitting &&
    pendingExtractions === 0;

  const handleConfirm = async () => {
    setIsCommitting(true);
    setCommitError(undefined);
    try {
      const { results: revalidated, batchErrors: revalidatedBatchErrors } =
        await fileActions.validateBatch(candidates);
      const revalidatedMap = new Map(
        revalidated.map((r) => [r.candidateId, r]),
      );
      setResults(revalidatedMap);
      setBatchErrors(revalidatedBatchErrors.map((e) => e.message));
      const stillInvalid = candidates.some(
        (candidate) =>
          revalidatedMap.get(candidate.id)?.status ===
          SkillFileValidationStatus.Invalid,
      );
      if (stillInvalid || revalidatedBatchErrors.length > 0) return;

      const result = await fileActions.commitBatch(candidates);
      if (result.error) {
        setCommitError(result.error);
        return;
      }
      onCommitted?.(candidates);
      onClose();
    } finally {
      setIsCommitting(false);
    }
  };

  const closeAriaLabel = t.uploadDialogCloseAriaLabel ?? 'Close';
  const cancelLabel = t.uploadCancelLabel ?? 'Cancel';
  const [activeConflict] = pendingConflicts;

  if (activeConflict) {
    const conflictTitle = t.uploadConflictTitle ?? 'Replace or duplicate it?';
    return (
      <SkillEditorDialog
        isOpen={isOpen}
        title={conflictTitle}
        closeAriaLabel={closeAriaLabel}
        onClose={() => resolveConflict(null)}
        confirmLabel={t.uploadConflictConfirmLabel ?? 'Confirm'}
        onConfirm={() => resolveConflict(conflictResolution)}
        cancelLabel={cancelLabel}
        onCancel={() => resolveConflict(null)}
      >
        <div className="flex flex-col gap-4 px-4 py-4 desktop:px-6">
          {/* Focused programmatically when the step opens, so it is not a tab stop and draws no ring. */}
          <p
            ref={conflictMessageRef}
            tabIndex={-1}
            className={mergeClasses('outline-hidden', messageClassName)}
          >
            {t.uploadConflictMessage?.(activeConflict.path) ??
              `Item with the same name "${activeConflict.path}" already exists.`}
          </p>
          <RadioGroup
            ariaLabel={conflictTitle}
            value={conflictResolution}
            onChange={(value) =>
              setConflictResolution(
                value === SkillFileConflictResolution.Duplicate
                  ? SkillFileConflictResolution.Duplicate
                  : SkillFileConflictResolution.Replace,
              )
            }
            items={[
              {
                value: SkillFileConflictResolution.Replace,
                label: t.uploadConflictReplaceLabel ?? 'Replace',
              },
              {
                value: SkillFileConflictResolution.Duplicate,
                label: t.uploadConflictDuplicateLabel ?? 'Duplicate',
              },
            ]}
          />
        </div>
      </SkillEditorDialog>
    );
  }

  return (
    <SkillEditorDialog
      isOpen={isOpen}
      title={
        isArchiveMode
          ? (t.uploadArchiveDialogTitle ?? 'Upload archive from device')
          : (t.uploadDialogTitle ?? 'Upload files from device')
      }
      closeAriaLabel={closeAriaLabel}
      onClose={onClose}
      confirmLabel={t.uploadConfirmLabel ?? 'Add'}
      onConfirm={() => void handleConfirm()}
      isConfirmDisabled={!canConfirm}
      isConfirming={isCommitting}
      cancelLabel={cancelLabel}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-4 px-4 py-4 desktop:px-6">
        <FileDropzone
          label={
            <>
              <span className="desktop:hidden">
                {isArchiveMode
                  ? (t.uploadArchiveDropZoneMobileLabel ??
                    'Click here to upload a .zip archive')
                  : (t.uploadDropZoneMobileLabel ?? 'Click here to upload')}
              </span>
              <span className="hidden desktop:inline">
                {isArchiveMode
                  ? (t.uploadArchiveDropZoneLabel ??
                    'Drag and drop a .zip archive or click here to upload')
                  : (t.uploadDropZoneLabel ??
                    'Drag and drop it or click here to upload')}
              </span>
            </>
          }
          description={
            isArchiveMode
              ? t.uploadArchiveDropZoneDescription
              : t.uploadDropZoneDescription
          }
          id={dropzoneInputId}
          ariaLabel={t.uploadDropZoneAriaLabel ?? 'Upload files'}
          multiple
          accept={isArchiveMode ? ARCHIVE_ACCEPT : undefined}
          className={
            isAllInvalid ? 'border-error hover:border-error' : undefined
          }
          onChange={addFiles}
          onReject={
            isArchiveMode
              ? () => setSourceError(archiveErrorMessage)
              : undefined
          }
        />

        {pendingExtractions > 0 && (
          <Spinner
            ariaLabel={t.uploadArchiveExtractingAriaLabel ?? 'Reading archive'}
          />
        )}
        <div role="alert">
          {sourceError && <ErrorText text={sourceError} />}
        </div>

        <span
          role="status"
          aria-live="polite"
          className="sr-only"
          id={liveRegionId}
        >
          {batchErrors
            .map(
              (message) =>
                `${t.uploadBatchErrorAriaPrefix ?? 'Upload error: '}${message}`,
            )
            .join(' ')}
        </span>
        {batchErrors.map((message) => (
          <ErrorText key={message} text={message} />
        ))}

        {candidates.length > 0 && (
          <ul className="flex flex-col gap-2">
            {candidates.map((candidate) => {
              const result = results.get(candidate.id);
              const isManifest =
                result?.kind === SkillFileCandidateKind.Manifest;
              const isInvalid =
                result?.status === SkillFileValidationStatus.Invalid;
              return (
                <li
                  key={candidate.id}
                  className="flex items-center gap-2 rounded-lg border border-tertiary p-2"
                >
                  <IconFileText
                    size={20}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="dial-small-text truncate">
                      {candidate.path}
                    </span>
                    <span className={rowCaptionClassName}>
                      {formatFileSize(candidate.file.size)}
                    </span>
                    {isInvalid && result?.error && (
                      <ErrorText text={result.error} />
                    )}
                    {isManifest && !isInvalid && (
                      <span className={rowCaptionClassName}>
                        {t.uploadManifestRowNote ??
                          "Will replace this Skill's name, description, and instructions"}
                      </span>
                    )}
                    {candidate.replacesExisting && !isInvalid && (
                      <span className={rowCaptionClassName}>
                        {t.uploadReplaceRowNote ??
                          'Will replace the existing file'}
                      </span>
                    )}
                  </div>
                  <GhostIconButton
                    icon={
                      <IconTrashX
                        size={16}
                        aria-hidden
                        stroke={DIAL_KIT_ICON_STROKE}
                      />
                    }
                    aria-label={
                      t.uploadRemoveCandidateLabel?.(candidate.path) ??
                      `Remove ${candidate.path}`
                    }
                    onClick={() => removeCandidate(candidate.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {commitError && <ErrorText text={commitError} />}
      </div>
    </SkillEditorDialog>
  );
};
