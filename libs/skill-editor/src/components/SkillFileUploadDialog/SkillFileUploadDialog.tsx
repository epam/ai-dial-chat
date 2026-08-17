import { formatFileSize, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ErrorText,
  GhostButton,
  GhostIconButton,
  Popup,
  PopupSize,
  PrimaryButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconFileText, IconTrashX, IconUpload } from '@tabler/icons-react';
import type { ChangeEvent, FC } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useSkillFileDropZone } from '../../hooks/useSkillFileDropZone';
import type {
  SkillEditorFileActions,
  SkillEditorLabels,
  SkillFileUploadCandidate,
  SkillFileValidationResult,
} from '../../models/skill-editor-props';
import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
} from '../../models/skill-editor-props';
import { resolveCandidatePath } from '../../utils/candidate-path';

/** Props for `SkillFileUploadDialog`. */
export interface SkillFileUploadDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Called to close the dialog (Escape, close control, Cancel, or a successful commit). */
  onClose: () => void;
  /** Batch validation/commit operations, host-owned. */
  fileActions: Pick<SkillEditorFileActions, 'validateBatch' | 'commitBatch'>;
  /**
   * Files to stage immediately when the dialog opens (e.g. files dropped
   * outside the dialog before it was open). Read once per open transition.
   */
  initialFiles?: File[];
  /** Text overrides. */
  labels?: SkillEditorLabels;
}

let candidateSeq = 0;
const nextCandidateId = (): string => `skill-file-candidate-${++candidateSeq}`;

/*
 * The AI DIAL UI Kit's `Popup` has no bottom-sheet variant (confirmed via the
 * ui-kit MCP), so this renders as the same centered modal at every
 * breakpoint rather than the bottom-sheet chrome Figma shows on mobile — a
 * documented deviation (design.md Open Question 2), not an oversight.
 */
/**
 * Upload dialog offering drag-and-drop and click-to-browse multi-file
 * staging, with per-row validation feedback and an atomic batch commit.
 */
export const SkillFileUploadDialog: FC<SkillFileUploadDialogProps> = ({
  isOpen,
  onClose,
  fileActions,
  initialFiles,
  labels,
}) => {
  const t = labels ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<SkillFileUploadCandidate[]>([]);
  const [results, setResults] = useState<
    Map<string, SkillFileValidationResult>
  >(new Map());
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [commitError, setCommitError] = useState<string | undefined>();
  const [isCommitting, setIsCommitting] = useState(false);

  const liveRegionId = useId();

  const addFiles = (files: File[]) => {
    const next = files.map<SkillFileUploadCandidate>((file) => ({
      id: nextCandidateId(),
      file,
      path: resolveCandidatePath(file),
    }));
    setCommitError(undefined);
    setCandidates((prev) => [...prev, ...next]);
  };

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
  };

  const { isDragActive, dropZoneHandlers } = useSkillFileDropZone(addFiles);

  // Reset all staged state whenever the dialog transitions closed -> open,
  // immediately staging any files it was opened with (e.g. dropped before
  // the dialog itself was open).
  useEffect(() => {
    if (!isOpen) return;
    setCandidates(
      (initialFiles ?? []).map((file) => ({
        id: nextCandidateId(),
        file,
        path: resolveCandidatePath(file),
      })),
    );
    setResults(new Map());
    setBatchErrors([]);
    setCommitError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per open transition, not on every initialFiles identity change
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

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) addFiles(files);
  };

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
    !isCommitting;

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
      onClose();
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Popup
      open={isOpen}
      header={t.uploadDialogTitle ?? 'Upload files from device'}
      size={PopupSize.Sm}
      closeAriaLabel={t.uploadDialogCloseAriaLabel ?? 'Close'}
      onClose={onClose}
      footer={
        <div className="flex min-h-[44px] items-center justify-end gap-2 px-6 py-4">
          <GhostButton
            label={t.uploadCancelLabel ?? 'Cancel'}
            onClick={onClose}
          />
          <PrimaryButton
            label={t.uploadConfirmLabel ?? 'Add'}
            iconBefore={
              isCommitting ? <Spinner size={16} ariaLabel="" /> : undefined
            }
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-6 py-4">
        <div
          role="button"
          tabIndex={0}
          aria-label={t.uploadDropZoneAriaLabel ?? 'Upload files'}
          className={mergeClasses(
            'bg-layer-2 flex min-h-[164px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-secondary px-6 py-9 focus-visible:outline focus-visible:outline-focus-black',
            isDragActive && 'bg-layer-3 border-accent-primary',
            isAllInvalid && 'border-error',
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          {...dropZoneHandlers}
        >
          <IconUpload size={32} aria-hidden />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="dial-small-text desktop:hidden">
              {t.uploadDropZoneMobileLabel ?? 'Click here to upload'}
            </span>
            <span className="dial-small-text hidden desktop:inline">
              {t.uploadDropZoneLabel ??
                'Drag and drop it or click here to upload'}
            </span>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />

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
                  <IconFileText size={20} aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="dial-small-text truncate">
                      {candidate.path}
                    </span>
                    <span className="dial-tiny-text text-secondary">
                      {formatFileSize(candidate.file.size)}
                    </span>
                    {isInvalid && result?.error && (
                      <ErrorText text={result.error} />
                    )}
                    {isManifest && !isInvalid && (
                      <span className="dial-tiny-text text-secondary">
                        {t.uploadManifestRowNote ??
                          "Will replace this Skill's name, description, and instructions"}
                      </span>
                    )}
                  </div>
                  <GhostIconButton
                    icon={<IconTrashX size={16} aria-hidden />}
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
    </Popup>
  );
};
