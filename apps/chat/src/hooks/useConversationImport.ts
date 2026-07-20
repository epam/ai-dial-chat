import type { Conversation } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  ResponseError,
  type ConversationResponseDto,
} from '@epam/chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
} from '../constants/translation-keys';
import { useUser } from '../context/auth/UserContext';
import { useConversations } from '../context/ConversationsContext';
import { useNotification } from '../context/NotificationContext';
import { UnauthorizedError } from '../server-api/base';
import { saveConversation } from '../server-api/conversations.api';
import { uploadFile } from '../server-api/files.api';
import { ExportJobStatus } from '../types/conversation-export';
import { runWithConcurrency } from '../utils/async';
import { collectAttachmentRefs } from '../utils/attachment-refs';
import { buildImportUploadPath } from '../utils/build-upload-path';
import { resolveDialFileBucketAndPath } from '../utils/dial-file';
import {
  formatQuotedNameList,
  getFolderBreadcrumb,
  parseImportEnvelope,
  rebaseConversationId,
  rewriteAttachmentUrls,
  UnsupportedImportFormatError,
} from '../utils/import-conversation';
import { parseDialArchive } from '../utils/zip-import';
import type { QueueJob } from '../models/conversation-queue';

/** Maximum number of concurrent attachment upload requests during an archive import. */
const ATTACHMENT_CONCURRENCY = 5;

/** File-extension check for `.dial`/`.zip` archive imports (vs. plain `.json`). */
const isArchiveFile = (file: File): boolean => /\.(dial|zip)$/i.test(file.name);

/*
 * `File.text()` is unavailable in some test environments (jsdom); FileReader
 * works consistently across both browsers and tests.
 */
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

interface ParsedImportFile {
  history: Conversation[];
  /** Attachment bytes keyed by bucket-relative path; empty for a plain `.json` import. */
  attachments: Map<string, Uint8Array>;
  /** Whether the source file was an archive (`.dial`/`.zip`) rather than plain `.json`. */
  isArchive: boolean;
}

const parseImportFile = async (file: File): Promise<ParsedImportFile> => {
  if (isArchiveFile(file)) {
    const { envelope, attachments } = await parseDialArchive(file);
    return {
      history: envelope.history,
      attachments,
      isArchive: true,
    };
  }
  const text = await readFileAsText(file);
  const envelope = parseImportEnvelope(text);
  return {
    history: envelope.history,
    attachments: new Map(),
    isArchive: false,
  };
};

type AttachmentUploadResult =
  | { kind: 'uploaded'; oldFileId: string; newFileId: string }
  | { kind: 'conflict'; name: string }
  | { kind: 'skipped'; name: string };

/** Best-effort display name for a fileId that failed to resolve to a `{bucket, path}` pair. */
const fileIdDisplayName = (fileId: string): string =>
  fileId.split('/').pop() || fileId;

/**
 * Uploads every attachment a conversation references to `uploads/<day>/`,
 * skipping (and reporting by name) any reference that cannot be resolved or
 * fails to upload. A destination name that already exists is reported
 * separately as a conflict (upload uses `create-only` mode — no silent
 * renaming). Returns a map from the conversation's original file ids to their
 * new uploaded location, ready for `rewriteAttachmentUrls`.
 */
const uploadConversationAttachments = async (
  conversation: Conversation,
  attachmentBytes: Map<string, Uint8Array>,
  bucket: string,
  date: Date,
  signal: AbortSignal,
): Promise<{
  urlMap: Map<string, string>;
  conflictNames: string[];
  skippedNames: string[];
  isUnauthorized: boolean;
}> => {
  const refs = collectAttachmentRefs(conversation);
  let isUnauthorized = false;

  const results = await runWithConcurrency(
    refs,
    ATTACHMENT_CONCURRENCY,
    async (ref): Promise<AttachmentUploadResult | undefined> => {
      if (signal.aborted || isUnauthorized) return undefined;
      const resolved = resolveDialFileBucketAndPath(ref.fileId);
      if (!resolved) {
        return { kind: 'skipped', name: fileIdDisplayName(ref.fileId) };
      }
      const fileName = resolved.path.split('/').pop() ?? resolved.path;
      const bytes = attachmentBytes.get(resolved.path);
      if (!bytes) {
        return { kind: 'skipped', name: fileName };
      }

      const uploadPath = buildImportUploadPath(fileName, date);
      try {
        /*
         * fflate's Uint8Array (from unzipSync) is typed over ArrayBufferLike,
         * which BlobPart does not accept — re-copy into a plain ArrayBuffer-backed
         * Uint8Array first (same workaround as zip-export.ts's toZipUint8Array).
         */
        const file = new File([new Uint8Array(bytes)], fileName);
        const response = await uploadFile(bucket, uploadPath, file, {
          uploadMode: 'create-only',
          signal,
        });
        return {
          kind: 'uploaded',
          oldFileId: ref.fileId,
          newFileId: response.url,
        };
      } catch (error) {
        if (signal.aborted) return undefined;
        if (error instanceof UnauthorizedError) {
          isUnauthorized = true;
          return undefined;
        }
        if (error instanceof ResponseError && error.response.status === 409) {
          return { kind: 'conflict', name: fileName };
        }
        return { kind: 'skipped', name: fileName };
      }
    },
  );

  const urlMap = new Map<string, string>();
  const conflictNames: string[] = [];
  const skippedNames: string[] = [];
  for (const result of results) {
    if (result.kind === 'uploaded') {
      urlMap.set(result.oldFileId, result.newFileId);
    } else if (result.kind === 'conflict') {
      conflictNames.push(result.name);
    } else {
      skippedNames.push(result.name);
    }
  }

  return {
    urlMap,
    conflictNames: signal.aborted || isUnauthorized ? [] : conflictNames,
    skippedNames: signal.aborted || isUnauthorized ? [] : skippedNames,
    isUnauthorized: !signal.aborted && isUnauthorized,
  };
};

interface UseConversationImportResult {
  /** Import jobs, most recently added last. Multiple jobs can be in progress concurrently. */
  jobs: QueueJob[];
  /** Parses the given file and starts importing it as a new job. */
  importConversations: (file: File) => Promise<void>;
  /** Removes a job from the queue. If still in progress, aborts its underlying requests. */
  dismissJob: (jobId: string) => void;
  /** Re-attempts a failed job in place (same job id, reusing the already-parsed file). */
  retryJob: (jobId: string) => void;
  /** Aborts all in-progress jobs and clears the entire queue. */
  dismissAll: () => void;
}

/**
 * Owns the import job queue: parses a selected export file (`.json` or
 * `.dial`/`.zip`, v5 envelope, old- or new-chat origin) once per file, then
 * re-uploads any archive attachments to `uploads/<YYYY-MM-DD>/`, rewrites
 * attachment references, regenerates each conversation's id/path with a
 * fresh UUID (collision-free save, no replace dialog), and persists every
 * conversation. Mirrors `useConversationExport`'s job-queue/cancel/retry
 * architecture — one job per imported file, not per conversation.
 */
export const useConversationImport = (): UseConversationImportResult => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { user } = useUser();
  const { refreshConversations } = useConversations();
  const [jobs, setJobs] = useState<QueueJob[]>([]);

  const controllersRef = useRef(new Map<string, AbortController>());
  const retryFnsRef = useRef(new Map<string, () => Promise<void>>());

  const updateJob = useCallback((jobId: string, patch: Partial<QueueJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    );
  }, []);

  const addJob = useCallback((label: string, description?: string): string => {
    const jobId = crypto.randomUUID();
    setJobs((prev) => [
      ...prev,
      { id: jobId, label, description, status: ExportJobStatus.InProgress },
    ]);
    return jobId;
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    controllersRef.current.get(jobId)?.abort();
    controllersRef.current.delete(jobId);
    retryFnsRef.current.delete(jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const runImportJob = useCallback(
    async (
      jobId: string,
      parsed: ParsedImportFile,
      signal: AbortSignal,
    ): Promise<void> => {
      const bucket = user?.bucket;
      if (!bucket) {
        updateJob(jobId, { status: ExportJobStatus.Failed });
        return;
      }

      const successNames: string[] = [];
      const failedNames: string[] = [];
      const conflictNames: string[] = [];
      const skippedAttachmentNames: string[] = [];
      let isUnauthorized = false;
      const today = new Date();

      for (const conversation of parsed.history) {
        if (signal.aborted) return;
        if (isUnauthorized) break;

        try {
          // TODO: a normalizeImportedConversation(conversation) step may be
          // needed here before upload/rebase, for old-chat-shaped files —
          // deferred per design.md until real-world testing shows which gaps
          // (missing lastActivityDate/assistantModelId/etc.) actually need
          // filling in.
          let urlMap = new Map<string, string>();
          if (parsed.isArchive) {
            const result = await uploadConversationAttachments(
              conversation,
              parsed.attachments,
              bucket,
              today,
              signal,
            );
            if (signal.aborted) return;
            if (result.isUnauthorized) {
              isUnauthorized = true;
              break;
            }
            if (result.skippedNames.length > 0) {
              skippedAttachmentNames.push(...result.skippedNames);
            }
            if (result.conflictNames.length > 0) {
              conflictNames.push(...result.conflictNames);
            }
            urlMap = result.urlMap;
          }

          const rewritten = rewriteAttachmentUrls(conversation, urlMap);
          const { conversation: regenerated, subPath } = rebaseConversationId(
            rewritten,
            bucket,
          );

          /*
           * `llmNamingDone` marks `name` as authoritative on the backend
           * (conversation.service.ts) — without it, the stored name is
           * treated as provisional and can be overwritten by the async LLM
           * auto-naming hook. The imported conversation already has its
           * real (exported) name, so force this true to keep it and skip
           * the naming hook, regardless of what the source file carried.
           */
          await saveConversation(
            subPath,
            {
              ...regenerated,
              llmNamingDone: true,
            } as ConversationResponseDto,
            signal,
          );
          if (signal.aborted) return;
          successNames.push(conversation.name);
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof UnauthorizedError) {
            isUnauthorized = true;
            break;
          }
          failedNames.push(conversation.name);
          console.error('Failed to import a conversation', error);
        }
      }
      if (signal.aborted) return;

      if (isUnauthorized) {
        updateJob(jobId, { status: ExportJobStatus.Failed });
        return;
      }

      if (successNames.length > 0) {
        try {
          await refreshConversations();
        } catch {
          /* The saves already succeeded; a refresh failure must not undo that success. */
        }
        showNotification({
          variant: NotificationVariant.Success,
          title: t(ConversationImportI18nKeys.SuccessTitle),
          message: t(ConversationImportI18nKeys.Success, {
            names: formatQuotedNameList(successNames),
          }),
        });
      }
      if (failedNames.length > 0) {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(ConversationImportI18nKeys.FailedTitle),
          message: t(ConversationImportI18nKeys.Failed, {
            names: formatQuotedNameList(failedNames),
          }),
        });
      }
      if (skippedAttachmentNames.length > 0) {
        showNotification({
          variant: NotificationVariant.Warning,
          message: t(ConversationImportI18nKeys.WarningAttachmentSkipped, {
            names: formatQuotedNameList(skippedAttachmentNames),
          }),
        });
      }
      if (conflictNames.length > 0) {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(ConversationImportI18nKeys.FailedTitle),
          message: t(ConversationImportI18nKeys.AttachmentNameConflict, {
            names: formatQuotedNameList(conflictNames),
          }),
        });
      }

      updateJob(jobId, {
        status:
          failedNames.length > 0
            ? ExportJobStatus.Failed
            : ExportJobStatus.Success,
      });
    },
    [refreshConversations, showNotification, t, updateJob, user?.bucket],
  );

  const importConversations = useCallback(
    async (file: File): Promise<void> => {
      let parsed: ParsedImportFile;
      try {
        parsed = await parseImportFile(file);
      } catch (error) {
        if (error instanceof UnsupportedImportFormatError) {
          showNotification({
            variant: NotificationVariant.Error,
            title: t(ConversationImportI18nKeys.FailedTitle),
            message: t(ConversationImportI18nKeys.UnsupportedFormat),
          });
          return;
        }
        showNotification({
          variant: NotificationVariant.Error,
          title: t(ConversationImportI18nKeys.FailedTitle),
          message: t(ConversationImportI18nKeys.UnsupportedFormat),
        });
        console.error('Failed to parse import file', error);
        return;
      }

      const isMultiple = parsed.history.length > 1;
      const firstConversation = parsed.history[0];
      const label = isMultiple
        ? t(ConversationExportI18nKeys.AllConversationsJobLabel)
        : (firstConversation?.name ?? file.name);
      const description =
        !isMultiple && firstConversation
          ? getFolderBreadcrumb(firstConversation)
          : undefined;

      const jobId = addJob(label, description);
      const run = (): Promise<void> => {
        const controller = new AbortController();
        controllersRef.current.set(jobId, controller);
        return runImportJob(jobId, parsed, controller.signal);
      };
      retryFnsRef.current.set(jobId, () => {
        updateJob(jobId, { status: ExportJobStatus.InProgress });
        return run();
      });
      return run();
    },
    [addJob, runImportJob, showNotification, t, updateJob],
  );

  const retryJob = useCallback((jobId: string) => {
    void retryFnsRef.current.get(jobId)?.();
  }, []);

  const dismissAll = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();
    retryFnsRef.current.clear();
    setJobs([]);
  }, []);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, []);

  return { jobs, importConversations, dismissJob, retryJob, dismissAll };
};
