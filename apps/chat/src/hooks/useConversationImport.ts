import {
  ResponseError,
  type ConversationResponseDto,
} from '@epam/ai-dial-chat-api-client';
import type { Conversation } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
} from '../constants/translation-keys';
import { useUser } from '../context/auth/UserContext';
import { useConversations } from '../context/ConversationsContext';
import { useNotification } from '../context/NotificationContext';
import type { QueueJob } from '../models/conversation-queue';
import { getApiErrorDetails } from '../server-api/api-error';
import { UnauthorizedError } from '../server-api/base';
import { saveConversation } from '../server-api/conversations.api';
import { listFiles, uploadFile } from '../server-api/files.api';
import { ExportJobStatus } from '../types/conversation-export';
import { runWithConcurrency } from '../utils/async';
import {
  createUploadPathAllocator,
  type UploadPathAllocator,
} from '../utils/build-upload-path';
import { formatDateYM } from '../utils/date';
import {
  formatQuotedNameList,
  getFolderBreadcrumb,
  parseImportEnvelope,
  planAttachmentUploads,
  rebaseConversationId,
  rewriteAttachmentUrls,
  UnsupportedImportFormatError,
  type RewrittenAttachmentTarget,
} from '../utils/import-conversation';
import { parseDialArchive } from '../utils/zip-import';

/** Maximum number of concurrent attachment upload requests during an archive import. */
const ATTACHMENT_CONCURRENCY = 5;
/**
 * Maximum number of ` (n)` re-allocation attempts after a create-only 409.
 * Lower than the backend's own retry budget (50, `files-upload.service.ts`)
 * because each retry here re-POSTs the whole attachment body over the user's
 * uplink, whereas the backend re-streams from a local temp file. With the
 * `listFiles` pre-fill in place, a 409 means another tab/session won a race —
 * losing several in a row is already pathological.
 */
const ATTACHMENT_CONFLICT_RETRY_LIMIT = 5;

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
  | {
      kind: 'uploaded';
      oldFileId: string;
      newFileId: string;
      newTitle?: string;
    }
  | { kind: 'skipped'; name: string };

/**
 * Uploads every attachment a conversation references, retrying under a
 * ` (n)`-suffixed name (via `allocator`) when a create-only upload hits a
 * name conflict (409) — up to `ATTACHMENT_CONFLICT_RETRY_LIMIT` times, after
 * which the attachment is reported as skipped instead. References that
 * cannot be resolved or have no matching archive bytes are reported as
 * skipped by `planAttachmentUploads` without ever reaching the network.
 * Returns a map from the conversation's original file ids to their new
 * uploaded location (and, when renamed, new display name), ready for
 * `rewriteAttachmentUrls`.
 */
const uploadConversationAttachments = async (
  conversation: Conversation,
  attachmentBytes: Map<string, Uint8Array>,
  bucket: string,
  allocator: UploadPathAllocator,
  signal: AbortSignal,
): Promise<{
  targetMap: Map<string, RewrittenAttachmentTarget>;
  skippedNames: string[];
  isUnauthorized: boolean;
}> => {
  const { plan, skippedNames: unplannedSkippedNames } = planAttachmentUploads(
    conversation,
    attachmentBytes,
    allocator,
  );
  let isUnauthorized = false;

  const results = await runWithConcurrency(
    plan,
    ATTACHMENT_CONCURRENCY,
    async (item): Promise<AttachmentUploadResult | undefined> => {
      if (signal.aborted || isUnauthorized) return undefined;

      let attempt = item.allocated;
      for (
        let retry = 0;
        retry <= ATTACHMENT_CONFLICT_RETRY_LIMIT;
        retry += 1
      ) {
        try {
          /*
           * fflate's Uint8Array (from unzipSync) is typed over ArrayBufferLike,
           * which BlobPart does not accept — re-copy into a plain ArrayBuffer-backed
           * Uint8Array first (same workaround as zip-export.ts's toZipUint8Array).
           */
          const file = new File([new Uint8Array(item.bytes)], attempt.fileName);
          const response = await uploadFile(bucket, attempt.path, file, {
            uploadMode: 'create-only',
            signal,
          });
          return {
            kind: 'uploaded',
            oldFileId: item.fileId,
            newFileId: response.url,
            newTitle: attempt.isRenamed ? attempt.fileName : undefined,
          };
        } catch (error) {
          if (signal.aborted) return undefined;
          if (error instanceof UnauthorizedError) {
            isUnauthorized = true;
            return undefined;
          }
          const isConflict =
            error instanceof ResponseError && error.response.status === 409;
          if (!isConflict || retry === ATTACHMENT_CONFLICT_RETRY_LIMIT) {
            return { kind: 'skipped', name: item.originalFileName };
          }
          allocator.markTaken(attempt.fileName);
          attempt = allocator.allocate(item.originalFileName);
        }
      }
      /* Unreachable: the loop above always returns, either on success or once
       * retries are exhausted — kept only to satisfy TS control-flow analysis. */
      return { kind: 'skipped', name: item.originalFileName };
    },
  );

  const targetMap = new Map<string, RewrittenAttachmentTarget>();
  const skippedNames: string[] = [...unplannedSkippedNames];
  for (const result of results) {
    if (result.kind === 'uploaded') {
      targetMap.set(result.oldFileId, {
        url: result.newFileId,
        ...(result.newTitle != null ? { title: result.newTitle } : {}),
      });
    } else {
      skippedNames.push(result.name);
    }
  }

  return {
    targetMap,
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
 * re-uploads any archive attachments to `uploads/<YYYY-MM>/` — disambiguating
 * a name collision with a ` (n)` suffix instead of rejecting it — rewrites
 * attachment references (and renamed titles), regenerates each conversation's
 * id/path with a fresh UUID (collision-free save, no replace dialog), and
 * persists every conversation. Mirrors `useConversationExport`'s
 * job-queue/cancel/retry architecture — one job per imported file, not per
 * conversation.
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
      const skippedAttachmentNames: string[] = [];
      let isUnauthorized = false;
      /* Only the first failing conversation's trace ID is shown — see the batch-failure rule
       * in api-error-trace-correlation's spec. */
      let firstFailureTraceId: string | undefined;
      const today = new Date();

      /*
       * The allocator is created once for the whole job (not per conversation)
       * so a source path referenced by two different conversations in the same
       * archive still gets a distinct, deterministic ` (n)` suffix rather than
       * two competing uploads. It is pre-filled from the destination folder's
       * current contents so a name that already exists in the bucket — from an
       * earlier upload or a previous import — is suffixed immediately instead
       * of round-tripping through a 409 first.
       */
      let allocator: UploadPathAllocator | undefined;
      if (parsed.isArchive) {
        const uploadFolder = `uploads/${formatDateYM(today)}`;
        let existingNames: string[] = [];
        try {
          const listing = await listFiles(
            { bucket, path: uploadFolder },
            signal,
          );
          existingNames = listing.items.map((item) => item.name);
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof UnauthorizedError) {
            updateJob(jobId, { status: ExportJobStatus.Failed });
            return;
          }
          /* Listing is an optimization, not a correctness requirement — a
           * missing month folder (404, common on the first import of the
           * month), a permissions error, or a network failure just means the
           * allocator starts empty and relies on retry-on-409 instead. */
          console.error(
            'Failed to list the upload folder for attachment name disambiguation',
            error,
          );
        }
        allocator = createUploadPathAllocator({ date: today, existingNames });
      }

      for (const conversation of parsed.history) {
        if (signal.aborted) return;
        if (isUnauthorized) break;

        try {
          /* TODO: a normalizeImportedConversation(conversation) step may be
           * needed here before upload/rebase, for old-chat-shaped files —
           * deferred per design.md until real-world testing shows which gaps
           * (missing lastActivityDate/assistantModelId/etc.) actually need
           * filling in. */
          let targetMap = new Map<string, RewrittenAttachmentTarget>();
          if (parsed.isArchive && allocator) {
            const result = await uploadConversationAttachments(
              conversation,
              parsed.attachments,
              bucket,
              allocator,
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
            targetMap = result.targetMap;
          }

          const rewritten = rewriteAttachmentUrls(conversation, targetMap);
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
          if (firstFailureTraceId === undefined) {
            firstFailureTraceId = (await getApiErrorDetails(error)).traceId;
          }
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
          requestId: firstFailureTraceId,
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
