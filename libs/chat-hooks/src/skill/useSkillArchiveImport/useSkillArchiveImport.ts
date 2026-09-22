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
  /** Submits the selected archive; the host owns request configuration and the client. */
  importArchive: (file: File) => Promise<TResult>;
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
  /** Reason the current/last selection was rejected locally; `undefined` once cleared. */
  selectionRejectionReason: SkillArchiveSelectionRejectionReason | undefined;
  /** Classified failure of the last import request; `undefined` outside a request failure. */
  errorKind: SkillArchiveImportErrorKind | undefined;
  /** Opens the dialog, unless an import is already in flight. */
  openDialog: () => void;
  /** Closes the dialog and clears any rejection reason. */
  closeDialog: () => void;
  /** Wire to the dialog drop zone's `onChange`. */
  handleFilesSelected: (files: File[]) => void;
  /** Wire to the dialog drop zone's `onReject`. */
  handleFilesRejected: () => void;
}

/**
 * Headless controller for the skill-archive upload flow: dialog visibility, the exact-filename
 * precheck, in-flight exclusion, and import completion. The host supplies the configured request
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

  const isUploadingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const submit = useCallback(
    async (file: File) => {
      isUploadingRef.current = true;
      setStatus(SkillArchiveImportStatus.Uploading);
      setErrorKind(undefined);

      try {
        const result = await importArchive(file);
        if (!isMountedRef.current) return;

        await onImported(result);
        if (!isMountedRef.current) return;

        setStatus(SkillArchiveImportStatus.Success);
      } catch (error) {
        if (!isMountedRef.current) return;

        const kind = classifySkillArchiveImportError(getApiErrorStatus(error));
        setStatus(SkillArchiveImportStatus.Error);
        setErrorKind(kind);
        onError(error, kind);
      } finally {
        isUploadingRef.current = false;
      }
    },
    [importArchive, onImported, onError],
  );

  const openDialog = useCallback(() => {
    if (isUploadingRef.current) return;
    setSelectionRejectionReason(undefined);
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setSelectionRejectionReason(undefined);
  }, []);

  /*
   * Rejection is local — no request/host callback fires — so the dialog can stay open for
   * another choice instead of being closed and reopened.
   */
  const rejectUnsupportedFilename = useCallback(() => {
    setStatus(SkillArchiveImportStatus.Error);
    setSelectionRejectionReason(
      SkillArchiveSelectionRejectionReason.UnsupportedFilename,
    );
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file || isUploadingRef.current) return;

      if (isUnsupportedMarkdownFilename(file.name, manifestFileName)) {
        rejectUnsupportedFilename();
        return;
      }

      setSelectionRejectionReason(undefined);
      setIsDialogOpen(false);
      void submit(file);
    },
    [manifestFileName, rejectUnsupportedFilename, submit],
  );

  return {
    isDialogOpen,
    status,
    selectionRejectionReason,
    errorKind,
    openDialog,
    closeDialog,
    handleFilesSelected,
    handleFilesRejected: rejectUnsupportedFilename,
  };
};
