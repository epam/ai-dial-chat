import type {
  ConversationListItemDto,
  ConversationsApi,
  FilesApi,
} from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferSubjectKind,
  ConversationTransferUnitKind,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { runWithConcurrency } from '../conversation-transfer/async';
import {
  collectAttachmentRefs,
  type AttachmentRef,
} from '../conversation-transfer/attachment-refs';
import { resolveDialFileBucketAndPath } from '../conversation-transfer/dial-file-resolve';
import {
  EXPORT_APP_NAME,
  buildExportEnvelope,
  buildExportFileName,
  serializeExportEnvelope,
} from '../conversation-transfer/export-conversation';
import {
  buildTransferProgress,
  ConversationTransferKind,
  ConversationTransferPhase,
} from '../conversation-transfer/progress';
import { useConversationTransferQueue } from '../conversation-transfer/queue';
import {
  ConversationExportMode,
  type ConversationTransferErrorEvent,
  type ConversationTransferSuccessEvent,
  ConversationTransferWarningCode,
  type ConversationTransferWarningEvent,
  ExportFileNameKind,
} from '../conversation-transfer/types';
import {
  buildDialArchive,
  type ZipAttachmentEntry,
} from '../conversation-transfer/zip-export';

/** Maximum number of concurrent attachment download requests during a ZIP export. */
const ATTACHMENT_CONCURRENCY = 5;

/**
 * Default ceiling on the summed byte length of an export's attachments.
 *
 * The bound is on *input* bytes even though what it protects is peak heap:
 * the archive pipeline holds roughly three copies at once — every attachment
 * in memory, `zipSync`'s output buffer (already-compressed media barely
 * shrinks), and the copy `buildDialArchive` makes before handing it to `Blob`.
 * 512 MiB of input therefore peaks near 1.5 GiB, which fits a 64-bit desktop
 * tab. Sizing this against the ~2 GiB single-`ArrayBuffer` ceiling would be
 * the wrong bound — that limits one buffer, not the three held together.
 */
export const DEFAULT_MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;

interface ExportErrorClassification {
  isUnauthorized?: boolean;
  isNotFound?: boolean;
}

/**
 * Export-all is scoped to the user's own chats — it must not include conversations
 * shared with the user or published to the organization.
 */
const isOwnConversation = (
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>,
): boolean => !item.sharedWithMe && !item.publishedWithMe;

/** A failed buffer allocation is how an over-large archive surfaces from `zipSync`. */
const isAllocationFailure = (error: unknown): boolean =>
  error instanceof RangeError;

/** Which weight table a single-conversation export uses, given its mode. */
const getExportKind = (
  mode: ConversationExportMode,
): ConversationTransferKind =>
  mode === ConversationExportMode.WithoutAttachments
    ? ConversationTransferKind.ExportSingle
    : ConversationTransferKind.ExportSingleWithAttachments;

/** Parameters for {@link useConversationExport}. */
export interface UseConversationExportParams {
  /** Already-configured generated-client instance used to read conversations. */
  conversationsApi: Pick<
    ConversationsApi,
    'getConversation' | 'listConversations'
  >;
  /** Already-configured generated-client instance used to download attachments. */
  filesApi: Pick<FilesApi, 'downloadFileRaw'>;
  /** Resolves a conversation id to the bucket-qualified path `getConversation` expects. */
  normalizeConversationPath: (conversationId: string) => string;
  /** Classifies a thrown error as unauthorized/not-found. Host-owned error taxonomy; defaults to neither. */
  classifyTransferError?: (error: unknown) => ExportErrorClassification;
  /** Resolves a trace id for a failing request, for display in an error notification. */
  resolveErrorTraceId?: (error: unknown) => Promise<string | undefined>;
  /**
   * Ceiling on the summed byte length of an export's attachments; a larger
   * export fails with `FileTooLarge` instead of being zipped. Defaults to
   * {@link DEFAULT_MAX_ARCHIVE_BYTES}.
   */
  maxArchiveBytes?: number;
  /** Called when a job completes successfully. */
  onSuccess?: (event: ConversationTransferSuccessEvent) => void;
  /** Called when a job succeeds but had to skip something (e.g. an unreachable attachment). */
  onWarning?: (event: ConversationTransferWarningEvent) => void;
  /** Called when a job fails. */
  onError?: (event: ConversationTransferErrorEvent) => void;
}

/** Return value of {@link useConversationExport}. */
export interface UseConversationExportResult {
  /** Export jobs, most recently added last. Multiple jobs can be in progress concurrently. */
  jobs: ConversationTransferJob[];
  /** Enqueues a single-conversation export job and starts it immediately. */
  exportSingle: (
    conversationId: string,
    title: string,
    mode: ConversationExportMode,
  ) => Promise<void>;
  /** Enqueues an export-all job and starts it immediately. */
  exportAll: () => Promise<void>;
  /** Aborts a job's underlying requests and marks it canceled, keeping it in `jobs`. */
  cancelJob: (jobId: string) => void;
  /** Removes a job from the queue. If still in progress, aborts its underlying requests. */
  dismissJob: (jobId: string) => void;
  /** Re-attempts a failed or canceled job in place (same job id, same parameters). */
  retryJob: (jobId: string) => void;
  /** Aborts all in-progress jobs and clears the entire queue. */
  dismissAll: () => void;
}

/**
 * Owns the export job queue: fetches conversation data through the injected
 * generated-client operations, builds the JSON v5 / ZIP output via the pure
 * export utils, reports determinate per-job progress and structured
 * success/warning/error events, and tracks each job's lifecycle (in progress /
 * success / failed / canceled) independently so multiple exports can run
 * concurrently.
 */
export const useConversationExport = ({
  conversationsApi,
  filesApi,
  normalizeConversationPath,
  classifyTransferError = () => ({}),
  resolveErrorTraceId = async () => undefined,
  maxArchiveBytes = DEFAULT_MAX_ARCHIVE_BYTES,
  onSuccess,
  onWarning,
  onError,
}: UseConversationExportParams): UseConversationExportResult => {
  const queue = useConversationTransferQueue();

  const fetchAttachments = useCallback(
    async (
      refs: AttachmentRef[],
      signal: AbortSignal,
      onUnitSettled: (completed: number, total: number) => void,
    ): Promise<{
      entries: ZipAttachmentEntry[];
      anySkipped: boolean;
      isUnauthorized: boolean;
    }> => {
      let anySkipped = false;
      let isUnauthorized = false;
      let settled = 0;

      const settleUnit = (): void => {
        settled += 1;
        onUnitSettled(settled, refs.length);
      };

      const entries = await runWithConcurrency(
        refs,
        ATTACHMENT_CONCURRENCY,
        async (ref): Promise<ZipAttachmentEntry | undefined> => {
          if (signal.aborted || isUnauthorized) return undefined;
          const resolved = resolveDialFileBucketAndPath(ref.fileId);
          if (!resolved) {
            anySkipped = true;
            settleUnit();
            return undefined;
          }
          try {
            const apiResponse = await filesApi.downloadFileRaw(
              { bucket: resolved.bucket, path: resolved.path },
              { signal },
            );
            const data = new Uint8Array(await apiResponse.raw.arrayBuffer());
            settleUnit();
            return { path: resolved.path, data };
          } catch (error) {
            if (signal.aborted) return undefined;
            if (classifyTransferError(error).isUnauthorized) {
              isUnauthorized = true;
              return undefined;
            }
            anySkipped = true;
            settleUnit();
            return undefined;
          }
        },
      );

      return {
        entries,
        anySkipped: !signal.aborted && !isUnauthorized && anySkipped,
        isUnauthorized: !signal.aborted && isUnauthorized,
      };
    },
    [classifyTransferError, filesApi],
  );

  const runExportSingle = useCallback(
    async (
      jobId: string,
      conversationId: string,
      title: string,
      mode: ConversationExportMode,
      fileName: string,
      signal: AbortSignal,
    ): Promise<void> => {
      const kind = getExportKind(mode);
      let conversation: Conversation;
      try {
        conversation = (await conversationsApi.getConversation(
          { path: normalizeConversationPath(conversationId) },
          { signal },
        )) as unknown as Conversation;
      } catch (error) {
        if (signal.aborted) return;
        const classification = classifyTransferError(error);
        if (!classification.isUnauthorized) {
          const traceId = await resolveErrorTraceId(error);
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unknown,
            titles: [title],
            traceId,
          });
          queue.failJob(jobId, ConversationTransferErrorCode.Unknown);
        } else {
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unauthorized,
          });
          queue.failJob(jobId, ConversationTransferErrorCode.Unauthorized);
        }
        console.error('Failed to fetch conversation for export', error);
        return;
      }
      if (signal.aborted) return;
      queue.setJobProgress(
        jobId,
        buildTransferProgress({
          kind,
          phase: ConversationTransferPhase.Prepare,
        }),
      );

      try {
        if (mode === ConversationExportMode.WithoutAttachments) {
          const envelope = buildExportEnvelope([conversation], []);
          const blob = serializeExportEnvelope(envelope);
          triggerBlobDownload(blob, fileName);
          onSuccess?.({ jobId, titles: [title] });
          queue.succeedJob(jobId);
          return;
        }

        const attachmentRefs = collectAttachmentRefs(conversation);
        const {
          entries: zipAttachments,
          anySkipped,
          isUnauthorized,
        } = await fetchAttachments(
          attachmentRefs,
          signal,
          (completed, total) => {
            queue.setJobProgress(
              jobId,
              buildTransferProgress(
                {
                  kind,
                  phase: ConversationTransferPhase.Transfer,
                  completed,
                  total,
                },
                {
                  completed,
                  total,
                  kind: ConversationTransferUnitKind.Attachment,
                },
              ),
            );
          },
        );
        if (signal.aborted) return;
        if (isUnauthorized) {
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unauthorized,
          });
          queue.failJob(jobId, ConversationTransferErrorCode.Unauthorized);
          return;
        }
        /* Credits the transfer phase in full for a conversation with no attachments. */
        queue.setJobProgress(
          jobId,
          buildTransferProgress({
            kind,
            phase: ConversationTransferPhase.Transfer,
            completed: attachmentRefs.length,
            total: attachmentRefs.length,
          }),
        );

        const totalBytes = zipAttachments.reduce(
          (total, entry) => total + entry.data.byteLength,
          0,
        );
        if (totalBytes > maxArchiveBytes) {
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.FileTooLarge,
            titles: [title],
          });
          queue.failJob(jobId, ConversationTransferErrorCode.FileTooLarge);
          console.error(
            `Refused to build an export archive of ${totalBytes} bytes: over the ${maxArchiveBytes}-byte limit`,
          );
          return;
        }

        const envelope = buildExportEnvelope([conversation], []);
        const { blob, skippedPaths } = buildDialArchive(
          envelope,
          zipAttachments,
        );
        const hasSkippedAttachments = anySkipped || skippedPaths.length > 0;
        if (hasSkippedAttachments) {
          onWarning?.({
            jobId,
            code: ConversationTransferWarningCode.AttachmentSkipped,
          });
        }
        triggerBlobDownload(blob, fileName);
        onSuccess?.({ jobId, titles: [title] });
        /*
         * The archive was still delivered, so this settles at 100% either way;
         * only the status differs, so the row can say the export is incomplete.
         */
        if (hasSkippedAttachments) {
          queue.warnJob(
            jobId,
            ConversationTransferWarningCode.AttachmentSkipped,
          );
        } else {
          queue.succeedJob(jobId);
        }
      } catch (error) {
        if (signal.aborted) return;
        const code = isAllocationFailure(error)
          ? ConversationTransferErrorCode.FileTooLarge
          : ConversationTransferErrorCode.Unknown;
        const traceId = await resolveErrorTraceId(error);
        onError?.({ jobId, code, titles: [title], traceId });
        queue.failJob(jobId, code);
        console.error('Failed to build conversation export archive', error);
      }
    },
    [
      classifyTransferError,
      conversationsApi,
      fetchAttachments,
      maxArchiveBytes,
      normalizeConversationPath,
      onError,
      onSuccess,
      onWarning,
      queue,
      resolveErrorTraceId,
    ],
  );

  const exportSingle = useCallback(
    (
      conversationId: string,
      title: string,
      mode: ConversationExportMode,
    ): Promise<void> => {
      const fileName = buildExportFileName(
        mode === ConversationExportMode.WithoutAttachments
          ? ExportFileNameKind.SingleConversation
          : ExportFileNameKind.SingleConversationWithAttachments,
        EXPORT_APP_NAME,
      );
      const jobId = queue.addJob(
        {
          kind: ConversationTransferSubjectKind.Single,
          title,
        },
        fileName,
      );
      return queue.startJob(jobId, (signal) =>
        runExportSingle(jobId, conversationId, title, mode, fileName, signal),
      );
    },
    [queue, runExportSingle],
  );

  const runExportAll = useCallback(
    async (
      jobId: string,
      fileName: string,
      signal: AbortSignal,
    ): Promise<void> => {
      const kind = ConversationTransferKind.ExportAll;
      const conversationRefs: Array<{ id: string; title: string }> = [];
      let nextToken: string | undefined;
      do {
        if (signal.aborted) return;
        let page: {
          items: ConversationListItemDto[];
          nextToken?: string;
        };
        try {
          page = await conversationsApi.listConversations(
            { nextToken },
            { signal },
          );
        } catch (error) {
          if (signal.aborted) return;
          const classification = classifyTransferError(error);
          if (!classification.isUnauthorized) {
            const traceId = await resolveErrorTraceId(error);
            onError?.({
              jobId,
              code: ConversationTransferErrorCode.Unknown,
              traceId,
            });
            queue.failJob(jobId, ConversationTransferErrorCode.Unknown);
          } else {
            onError?.({
              jobId,
              code: ConversationTransferErrorCode.Unauthorized,
            });
            queue.failJob(jobId, ConversationTransferErrorCode.Unauthorized);
          }
          console.error('Failed to list conversations for export', error);
          return;
        }
        conversationRefs.push(
          ...page.items
            .filter(isOwnConversation)
            .map((item) => ({ id: item.id, title: item.title })),
        );
        nextToken = page.nextToken;
      } while (nextToken);
      queue.setJobProgress(
        jobId,
        buildTransferProgress({
          kind,
          phase: ConversationTransferPhase.Prepare,
        }),
      );

      const conversations: Conversation[] = [];
      for (const ref of conversationRefs) {
        if (signal.aborted) return;
        try {
          const conversation = (await conversationsApi.getConversation(
            { path: normalizeConversationPath(ref.id) },
            { signal },
          )) as unknown as Conversation;
          conversations.push(conversation);
        } catch (error) {
          if (signal.aborted) return;
          const classification = classifyTransferError(error);
          if (classification.isUnauthorized) {
            onError?.({
              jobId,
              code: ConversationTransferErrorCode.Unauthorized,
            });
            queue.failJob(jobId, ConversationTransferErrorCode.Unauthorized);
            return;
          }
          if (classification.isNotFound) {
            const traceId = await resolveErrorTraceId(error);
            onError?.({
              jobId,
              code: ConversationTransferErrorCode.NotFound,
              titles: [ref.title],
              traceId,
            });
            console.error(
              'Skipped a conversation during export-all: not found',
              error,
            );
            continue;
          }
          const traceId = await resolveErrorTraceId(error);
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unknown,
            traceId,
          });
          queue.failJob(jobId, ConversationTransferErrorCode.Unknown);
          console.error(
            'Aborted export-all: failed to fetch conversation',
            error,
          );
          return;
        } finally {
          queue.setJobProgress(
            jobId,
            buildTransferProgress(
              {
                kind,
                phase: ConversationTransferPhase.Transfer,
                completed: conversations.length,
                total: conversationRefs.length,
              },
              {
                completed: conversations.length,
                total: conversationRefs.length,
                kind: ConversationTransferUnitKind.Conversation,
              },
            ),
          );
        }
      }
      if (signal.aborted) return;

      try {
        const envelope = buildExportEnvelope(conversations, []);
        const blob = serializeExportEnvelope(envelope);
        triggerBlobDownload(blob, fileName);
        onSuccess?.({ jobId });
        queue.succeedJob(jobId);
      } catch (error) {
        const code = isAllocationFailure(error)
          ? ConversationTransferErrorCode.FileTooLarge
          : ConversationTransferErrorCode.Unknown;
        const traceId = await resolveErrorTraceId(error);
        onError?.({ jobId, code, traceId });
        queue.failJob(jobId, code);
        console.error('Failed to build export-all archive', error);
      }
    },
    [
      classifyTransferError,
      conversationsApi,
      normalizeConversationPath,
      onError,
      onSuccess,
      queue,
      resolveErrorTraceId,
    ],
  );

  const exportAll = useCallback((): Promise<void> => {
    const fileName = buildExportFileName(
      ExportFileNameKind.AllConversationsHistory,
      EXPORT_APP_NAME,
    );
    const jobId = queue.addJob(
      { kind: ConversationTransferSubjectKind.All },
      fileName,
    );
    return queue.startJob(jobId, (signal) =>
      runExportAll(jobId, fileName, signal),
    );
  }, [queue, runExportAll]);

  return {
    jobs: queue.jobs,
    exportSingle,
    exportAll,
    cancelJob: queue.cancelJob,
    dismissJob: queue.dismissJob,
    retryJob: queue.retryJob,
    dismissAll: queue.dismissAll,
  };
};
