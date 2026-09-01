import type {
  ConversationListItemDto,
  ConversationsApi,
  FilesApi,
} from '@epam/ai-dial-chat-api-client';
import {
  type Conversation,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  ConversationTransferSubjectKind,
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
import { useConversationTransferQueue } from '../conversation-transfer/queue';
import {
  ConversationExportMode,
  ConversationTransferErrorCode,
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
  /** Removes a job from the queue. If still in progress, aborts its underlying requests. */
  dismissJob: (jobId: string) => void;
  /** Re-attempts a failed job in place (same job id, same parameters). */
  retryJob: (jobId: string) => void;
  /** Aborts all in-progress jobs and clears the entire queue. */
  dismissAll: () => void;
}

/**
 * Owns the export job queue: fetches conversation data through the injected
 * generated-client operations, builds the JSON v5 / ZIP output via the pure
 * export utils, reports structured success/warning/error events, and tracks
 * each job's lifecycle (in progress / success / failed) independently so
 * multiple exports can run concurrently.
 */
export const useConversationExport = ({
  conversationsApi,
  filesApi,
  normalizeConversationPath,
  classifyTransferError = () => ({}),
  resolveErrorTraceId = async () => undefined,
  onSuccess,
  onWarning,
  onError,
}: UseConversationExportParams): UseConversationExportResult => {
  const queue = useConversationTransferQueue();

  const fetchAttachments = useCallback(
    async (
      refs: AttachmentRef[],
      signal: AbortSignal,
    ): Promise<{
      entries: ZipAttachmentEntry[];
      anySkipped: boolean;
      isUnauthorized: boolean;
    }> => {
      let anySkipped = false;
      let isUnauthorized = false;

      const entries = await runWithConcurrency(
        refs,
        ATTACHMENT_CONCURRENCY,
        async (ref): Promise<ZipAttachmentEntry | undefined> => {
          if (signal.aborted || isUnauthorized) return undefined;
          const resolved = resolveDialFileBucketAndPath(ref.fileId);
          if (!resolved) {
            anySkipped = true;
            return undefined;
          }
          try {
            const apiResponse = await filesApi.downloadFileRaw(
              { bucket: resolved.bucket, path: resolved.path },
              { signal },
            );
            const data = new Uint8Array(await apiResponse.raw.arrayBuffer());
            return { path: resolved.path, data };
          } catch (error) {
            if (signal.aborted) return undefined;
            if (classifyTransferError(error).isUnauthorized) {
              isUnauthorized = true;
              return undefined;
            }
            anySkipped = true;
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
      signal: AbortSignal,
    ): Promise<void> => {
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
        } else {
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unauthorized,
          });
        }
        queue.updateJob(jobId, {
          status: ConversationTransferJobStatus.Failed,
        });
        console.error('Failed to fetch conversation for export', error);
        return;
      }
      if (signal.aborted) return;

      try {
        if (mode === ConversationExportMode.WithoutAttachments) {
          const envelope = buildExportEnvelope([conversation], []);
          const blob = serializeExportEnvelope(envelope);
          const fileName = buildExportFileName(
            ExportFileNameKind.SingleConversation,
            EXPORT_APP_NAME,
          );
          triggerBlobDownload(blob, fileName);
          onSuccess?.({ jobId, titles: [title] });
          queue.updateJob(jobId, {
            status: ConversationTransferJobStatus.Success,
          });
          return;
        }

        const attachmentRefs = collectAttachmentRefs(conversation);
        const {
          entries: zipAttachments,
          anySkipped,
          isUnauthorized,
        } = await fetchAttachments(attachmentRefs, signal);
        if (signal.aborted) return;
        if (isUnauthorized) {
          onError?.({
            jobId,
            code: ConversationTransferErrorCode.Unauthorized,
          });
          queue.updateJob(jobId, {
            status: ConversationTransferJobStatus.Failed,
          });
          return;
        }
        const envelope = buildExportEnvelope([conversation], []);
        const { blob, skippedPaths } = buildDialArchive(
          envelope,
          zipAttachments,
        );
        if (anySkipped || skippedPaths.length > 0) {
          onWarning?.({
            jobId,
            code: ConversationTransferWarningCode.AttachmentSkipped,
          });
        }
        const fileName = buildExportFileName(
          ExportFileNameKind.SingleConversationWithAttachments,
          EXPORT_APP_NAME,
        );
        triggerBlobDownload(blob, fileName);
        onSuccess?.({ jobId, titles: [title] });
        queue.updateJob(jobId, {
          status: ConversationTransferJobStatus.Success,
        });
      } catch (error) {
        if (signal.aborted) return;
        const traceId = await resolveErrorTraceId(error);
        onError?.({
          jobId,
          code: ConversationTransferErrorCode.Unknown,
          titles: [title],
          traceId,
        });
        queue.updateJob(jobId, {
          status: ConversationTransferJobStatus.Failed,
        });
        console.error('Failed to build conversation export archive', error);
      }
    },
    [
      classifyTransferError,
      conversationsApi,
      fetchAttachments,
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
      const jobId = queue.addJob({
        kind: ConversationTransferSubjectKind.Single,
        title,
      });
      return queue.startJob(jobId, (signal) =>
        runExportSingle(jobId, conversationId, title, mode, signal),
      );
    },
    [queue, runExportSingle],
  );

  const runExportAll = useCallback(
    async (jobId: string, signal: AbortSignal): Promise<void> => {
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
          } else {
            onError?.({
              jobId,
              code: ConversationTransferErrorCode.Unauthorized,
            });
          }
          queue.updateJob(jobId, {
            status: ConversationTransferJobStatus.Failed,
          });
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
            queue.updateJob(jobId, {
              status: ConversationTransferJobStatus.Failed,
            });
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
          queue.updateJob(jobId, {
            status: ConversationTransferJobStatus.Failed,
          });
          console.error(
            'Aborted export-all: failed to fetch conversation',
            error,
          );
          return;
        }
      }
      if (signal.aborted) return;

      try {
        const envelope = buildExportEnvelope(conversations, []);
        const blob = serializeExportEnvelope(envelope);
        const fileName = buildExportFileName(
          ExportFileNameKind.AllConversationsHistory,
          EXPORT_APP_NAME,
        );
        triggerBlobDownload(blob, fileName);
        onSuccess?.({ jobId });
        queue.updateJob(jobId, {
          status: ConversationTransferJobStatus.Success,
        });
      } catch (error) {
        const traceId = await resolveErrorTraceId(error);
        onError?.({
          jobId,
          code: ConversationTransferErrorCode.Unknown,
          traceId,
        });
        queue.updateJob(jobId, {
          status: ConversationTransferJobStatus.Failed,
        });
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
    const jobId = queue.addJob({ kind: ConversationTransferSubjectKind.All });
    return queue.startJob(jobId, (signal) => runExportAll(jobId, signal));
  }, [queue, runExportAll]);

  return {
    jobs: queue.jobs,
    exportSingle,
    exportAll,
    dismissJob: queue.dismissJob,
    retryJob: queue.retryJob,
    dismissAll: queue.dismissAll,
  };
};
