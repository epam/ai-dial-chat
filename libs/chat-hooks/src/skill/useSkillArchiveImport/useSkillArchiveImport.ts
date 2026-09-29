import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorStatus } from '../../api-error/api-error';

const DEFAULT_MANIFEST_FILE_NAME = 'SKILL.md';

/** Phase of a skill-archive import, driving the host's loading/success/error presentation. */
export enum SkillArchiveImportStatus {
  Idle = 'idle',
  Uploading = 'uploading',
  Success = 'success',
  Error = 'error',
}

/** Semantic classification of an import request failure. */
export enum SkillArchiveImportErrorKind {
  Validation = 'validation',
  Collision = 'collision',
  RateLimited = 'rateLimited',
  ServiceUnavailable = 'serviceUnavailable',
  Generic = 'generic',
}

/** Reason a selected/dropped file was rejected before any request was made. */
export enum SkillArchiveSelectionRejectionReason {
  UnsupportedFilename = 'unsupportedFilename',
}

/**
 * Classifies an import request's HTTP status into a semantic outcome: 400/413/422 are
 * archive-content problems, 409 is a name collision, 429 is rate limiting, 502/503 mean the
 * backend is unavailable, and anything else (including no status at all) is generic.
 */
export const classifySkillArchiveImportError = (
  status: number | undefined,
): SkillArchiveImportErrorKind => {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return SkillArchiveImportErrorKind.Validation;
    case 409:
      return SkillArchiveImportErrorKind.Collision;
    case 429:
      return SkillArchiveImportErrorKind.RateLimited;
    case 502:
    case 503:
      return SkillArchiveImportErrorKind.ServiceUnavailable;
    default:
      return SkillArchiveImportErrorKind.Generic;
  }
};

const isUnsupportedMarkdownFilename = (
  fileName: string,
  manifestFileName: string,
): boolean =>
  fileName.toLowerCase().endsWith('.md') && fileName !== manifestFileName;

/** Options accepted by {@link useSkillArchiveImport}. */
export interface UseSkillArchiveImportOptions<TResult> {
  /** Submits the selected archive; the host owns the client. `signal` aborts when the dialog closes or the hook unmounts mid-upload. */
  importArchive: (file: File, signal: AbortSignal) => Promise<TResult>;
  /** Called once after a successful import (and any awaited host follow-up) settles. */
  onImported: (result: TResult) => void | Promise<void>;
  /** Called once when the import request, or the host's follow-up in {@link onImported}, fails. */
  onError: (error: unknown, kind: SkillArchiveImportErrorKind) => void;
  /** Exact filename treated as the skill manifest. Defaults to `'SKILL.md'`. */
  manifestFileName?: string;
}

/** Result returned by {@link useSkillArchiveImport}. */
export interface UseSkillArchiveImportResult {
  /** Whether the upload dialog is open. */
  isDialogOpen: boolean;
  /** Current phase of the import. */
  status: SkillArchiveImportStatus;
  /** Whether an import request is in flight; the dialog stays open until it succeeds. */
  isUploading: boolean;
  /** Reason the current/last selection was rejected locally; `undefined` once cleared. */
  selectionRejectionReason: SkillArchiveSelectionRejectionReason | undefined;
  /** Classified failure of the last import request; `undefined` outside a request failure. */
  errorKind: SkillArchiveImportErrorKind | undefined;
  /** Opens the dialog and clears any previous rejection or request failure. */
  openDialog: () => void;
  /** Closes the dialog, aborting an in-flight import, and clears any rejection reason. */
  closeDialog: () => void;
  /** Wire to the dialog drop zone's `onChange`. */
  handleFilesSelected: (files: File[]) => void;
  /** Wire to the dialog drop zone's `onReject`. */
  handleFilesRejected: () => void;
}

/**
 * Headless controller for the skill-archive upload flow: dialog visibility, the exact-filename
 * precheck, in-flight exclusion, abort-on-close, and import completion. The host supplies the configured request
 * and observes completion/failure through the injected callbacks; the hook never imports app
 * contexts, i18n, or a configured API client.
 */
export const useSkillArchiveImport = <TResult>({
  importArchive,
  onImported,
  onError,
  manifestFileName = DEFAULT_MANIFEST_FILE_NAME,
}: UseSkillArchiveImportOptions<TResult>): UseSkillArchiveImportResult => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [status, setStatus] = useState<SkillArchiveImportStatus>(
    SkillArchiveImportStatus.Idle,
  );
  const [selectionRejectionReason, setSelectionRejectionReason] = useState<
    SkillArchiveSelectionRejectionReason | undefined
  >(undefined);
  const [errorKind, setErrorKind] = useState<
    SkillArchiveImportErrorKind | undefined
  >(undefined);

  /* The in-flight request's controller; `null` when idle. Aborting it detaches its outcome. */
  const uploadAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      uploadAbortRef.current?.abort();
      uploadAbortRef.current = null;
    },
    [],
  );

  const submit = useCallback(
    async (file: File) => {
      const abortController = new AbortController();
      uploadAbortRef.current = abortController;
      const { signal } = abortController;
      setStatus(SkillArchiveImportStatus.Uploading);
      setErrorKind(undefined);

      try {
        const result = await importArchive(file, signal);
        if (signal.aborted) return;

        await onImported(result);
        if (signal.aborted) return;

        setStatus(SkillArchiveImportStatus.Success);
        setIsDialogOpen(false);
      } catch (error) {
        if (signal.aborted) return;

        /*
         * The dialog stays open, so the failure renders next to the drop zone and another file
         * can be picked straight away.
         */
        const kind = classifySkillArchiveImportError(getApiErrorStatus(error));
        setStatus(SkillArchiveImportStatus.Error);
        setErrorKind(kind);
        onError(error, kind);
      } finally {
        if (uploadAbortRef.current === abortController) {
          uploadAbortRef.current = null;
        }
      }
    },
    [importArchive, onImported, onError],
  );

  const openDialog = useCallback(() => {
    if (uploadAbortRef.current) return;
    setSelectionRejectionReason(undefined);
    setErrorKind(undefined);
    setStatus(SkillArchiveImportStatus.Idle);
    setIsDialogOpen(true);
  }, []);

  /*
   * Closing mid-upload aborts the request, so a slow or hanging backend can never leave the
   * flow locked with no dialog to recover from.
   */
  const closeDialog = useCallback(() => {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
      setStatus(SkillArchiveImportStatus.Idle);
    }
    setIsDialogOpen(false);
    setSelectionRejectionReason(undefined);
  }, []);

  /*
   * Rejection is local — no request/host callback fires — so the dialog can stay open for
   * another choice instead of being closed and reopened.
   */
  const rejectUnsupportedFilename = useCallback(() => {
    if (uploadAbortRef.current) return;
    setStatus(SkillArchiveImportStatus.Error);
    setErrorKind(undefined);
    setSelectionRejectionReason(
      SkillArchiveSelectionRejectionReason.UnsupportedFilename,
    );
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file || uploadAbortRef.current) return;

      if (isUnsupportedMarkdownFilename(file.name, manifestFileName)) {
        rejectUnsupportedFilename();
        return;
      }

      setSelectionRejectionReason(undefined);
      void submit(file);
    },
    [manifestFileName, rejectUnsupportedFilename, submit],
  );

  return {
    isDialogOpen,
    status,
    isUploading: status === SkillArchiveImportStatus.Uploading,
    selectionRejectionReason,
    errorKind,
    openDialog,
    closeDialog,
    handleFilesSelected,
    handleFilesRejected: rejectUnsupportedFilename,
  };
};
