import type { Conversation } from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  ResponseError,
  type ConversationListItemDto,
} from '@epam/chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeConversationId } from '../constants/routes';
import { ConversationExportI18nKeys } from '../constants/translation-keys';
import { useNotification } from '../context/NotificationContext';
import { UnauthorizedError } from '../server-api/base';
import {
  getConversation,
  listConversations,
} from '../server-api/conversations.api';
import { downloadFile } from '../server-api/files.api';
import {
  ConversationExportMode,
  ExportFileNameKind,
  ExportJobStatus,
  type ExportJob,
} from '../types/conversation-export';
import { isDialFileId, resolveDialFileBucketAndPath } from '../utils/dial-file';
import {
  buildExportEnvelope,
  buildExportFileName,
  serializeExportEnvelope,
} from '../utils/export-conversation';
import { triggerBlobDownload } from '../utils/file-download';
import { buildDialArchive, type ZipAttachmentEntry } from '../utils/zip-export';

/** Placeholder app name used in export file names — this branch has no app display-name config yet. */
const EXPORT_APP_NAME = 'ai_dial';
/** Maximum number of concurrent attachment download requests during a ZIP export. */
const ATTACHMENT_CONCURRENCY = 5;

interface ExportErrorClassification {
  isUnauthorized: boolean;
  isNotFound: boolean;
}

/**
 * Classifies a thrown error for export purposes. Beyond the unauthorized/not-found
 * distinction (needed to decide silent-defer vs skip-and-continue behavior), no
 * other HTTP status is treated differently — the visible toast text is a single
 * generic per-conversation message naming the conversation, not one message per status.
 */
const classifyExportError = (error: unknown): ExportErrorClassification => {
  if (error instanceof UnauthorizedError) {
    return { isUnauthorized: true, isNotFound: false };
  }
  if (error instanceof ResponseError && error.response.status === 404) {
    return { isUnauthorized: false, isNotFound: true };
  }
  return { isUnauthorized: false, isNotFound: false };
};

/**
 * `ConversationListItemDto.id` (and the panel's context id) is the full DIAL Core
 * resource id, e.g. `conversations/{bucket}/{name}`. `getConversation`'s backend
 * handler expects `{bucket}/{name}` (bucket kept — needed to correctly route
 * shared/public/cross-bucket conversations) — strip only the leading `conversations/`
 * segment, the same normalization `getConversationRoute` applies when building a
 * conversation's URL (`apps/chat/src/constants/routes.ts`). Do NOT chain
 * `getConversationPath` on top here — that additionally strips the bucket, which is
 * correct for delete/rename but wrong for get-by-path.
 */
const toApiConversationPath = (conversationId: string): string =>
  normalizeConversationId(conversationId);

/**
 * Export-all is scoped to the user's own chats — it must not include conversations
 * shared with the user or published to the organization (mirrors the panel's
 * `getConversationSource` classification in `ConversationPanel/get-conversation-source.ts`).
 */
const isOwnConversation = (
  item: Pick<ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe'>,
): boolean => !item.sharedWithMe && !item.publishedWithMe;

interface AttachmentRef {
  fileId: string;
}

/**
 * Collects unique attachment references across all messages. The same file can be
 * attached to more than one message (e.g. re-shared in a later turn) — dedupe by
 * `fileId` so it is fetched and zipped only once instead of once per occurrence.
 */
const collectAttachmentRefs = (conversation: Conversation): AttachmentRef[] => {
  const fileIds = new Set<string>();
  for (const message of conversation.messages) {
    for (const attachment of message.custom_content?.attachments ?? []) {
      const fileId = attachment.url ?? attachment.reference_url;
      if (fileId != null && isDialFileId(fileId)) {
        fileIds.add(fileId);
      }
    }
  }
  return Array.from(fileIds, (fileId) => ({ fileId }));
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | undefined>,
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= items.length) return;
    const result = await worker(items[currentIndex]);
    if (result !== undefined) results.push(result);
    await runNext();
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
  return results;
};

interface UseConversationExportResult {
  /** Export jobs, most recently added last. Multiple jobs can be in progress concurrently. */
  jobs: ExportJob[];
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
 * Owns the export job queue: fetches conversation data through the server-api
 * wrappers, builds the JSON v5 / ZIP output via the pure export utils, maps
 * errors to success/failure/warning toasts, and tracks each job's lifecycle
 * (in progress / success / failed) independently so multiple exports can run
 * concurrently.
 */
export const useConversationExport = (): UseConversationExportResult => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [jobs, setJobs] = useState<ExportJob[]>([]);

  const controllersRef = useRef(new Map<string, AbortController>());
  const retryFnsRef = useRef(new Map<string, () => Promise<void>>());

  const updateJob = useCallback((jobId: string, patch: Partial<ExportJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    );
  }, []);

  const addJob = useCallback((label: string): string => {
    const jobId = crypto.randomUUID();
    setJobs((prev) => [
      ...prev,
      { id: jobId, label, status: ExportJobStatus.InProgress },
    ]);
    return jobId;
  }, []);

  const dismissJob = useCallback((jobId: string) => {
    controllersRef.current.get(jobId)?.abort();
    controllersRef.current.delete(jobId);
    retryFnsRef.current.delete(jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  }, []);

  const fetchAttachments = useCallback(
    async (
      refs: AttachmentRef[],
      signal: AbortSignal,
    ): Promise<{ entries: ZipAttachmentEntry[]; anySkipped: boolean }> => {
      let anySkipped = false;

      const entries = await runWithConcurrency(
        refs,
        ATTACHMENT_CONCURRENCY,
        async (ref): Promise<ZipAttachmentEntry | undefined> => {
          if (signal.aborted) return undefined;
          const resolved = resolveDialFileBucketAndPath(ref.fileId);
          if (!resolved) {
            anySkipped = true;
            return undefined;
          }
          try {
            const response = await downloadFile(
              resolved.bucket,
              resolved.path,
              signal,
            );
            const data = new Uint8Array(await response.arrayBuffer());
            return { path: resolved.path, data };
          } catch (error) {
            if (signal.aborted) return undefined;
            anySkipped = true;
            console.error('Failed to fetch attachment for export', error);
            return undefined;
          }
        },
      );

      return { entries, anySkipped: !signal.aborted && anySkipped };
    },
    [],
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
        conversation = (await getConversation(
          toApiConversationPath(conversationId),
          signal,
        )) as Conversation;
      } catch (error) {
        if (signal.aborted) return;
        const classification = classifyExportError(error);
        if (!classification.isUnauthorized) {
          showNotification({
            variant: NotificationVariant.Error,
            title: t(ConversationExportI18nKeys.FailedTitle),
            message: t(ConversationExportI18nKeys.FailedSingle, { title }),
          });
        }
        updateJob(jobId, { status: ExportJobStatus.Failed });
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
          showNotification({
            variant: NotificationVariant.Success,
            title: t(ConversationExportI18nKeys.SuccessTitle),
            message: t(ConversationExportI18nKeys.SuccessSingle, { title }),
          });
          updateJob(jobId, { status: ExportJobStatus.Success });
          return;
        }

        const attachmentRefs = collectAttachmentRefs(conversation);
        const { entries: zipAttachments, anySkipped } = await fetchAttachments(
          attachmentRefs,
          signal,
        );
        if (signal.aborted) return;
        const envelope = buildExportEnvelope([conversation], []);
        const { blob, skippedPaths } = buildDialArchive(
          envelope,
          zipAttachments,
        );
        if (anySkipped || skippedPaths.length > 0) {
          showNotification({
            variant: NotificationVariant.Warning,
            message: t(ConversationExportI18nKeys.WarningAttachmentSkipped),
          });
        }
        const fileName = buildExportFileName(
          ExportFileNameKind.SingleConversationWithAttachments,
          EXPORT_APP_NAME,
        );
        triggerBlobDownload(blob, fileName);
        showNotification({
          variant: NotificationVariant.Success,
          title: t(ConversationExportI18nKeys.SuccessTitle),
          message: t(ConversationExportI18nKeys.SuccessSingle, { title }),
        });
        updateJob(jobId, { status: ExportJobStatus.Success });
      } catch (error) {
        if (signal.aborted) return;
        showNotification({
          variant: NotificationVariant.Error,
          title: t(ConversationExportI18nKeys.FailedTitle),
          message: t(ConversationExportI18nKeys.FailedSingle, { title }),
        });
        updateJob(jobId, { status: ExportJobStatus.Failed });
        console.error('Failed to build conversation export archive', error);
      }
    },
    [fetchAttachments, showNotification, t, updateJob],
  );

  const exportSingle = useCallback(
    (
      conversationId: string,
      title: string,
      mode: ConversationExportMode,
    ): Promise<void> => {
      const jobId = addJob(title);
      const run = (): Promise<void> => {
        const controller = new AbortController();
        controllersRef.current.set(jobId, controller);
        return runExportSingle(
          jobId,
          conversationId,
          title,
          mode,
          controller.signal,
        );
      };
      retryFnsRef.current.set(jobId, () => {
        updateJob(jobId, { status: ExportJobStatus.InProgress });
        return run();
      });
      return run();
    },
    [addJob, runExportSingle, updateJob],
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
          page = await listConversations({ nextToken }, signal);
        } catch (error) {
          if (signal.aborted) return;
          const classification = classifyExportError(error);
          if (!classification.isUnauthorized) {
            showNotification({
              variant: NotificationVariant.Error,
              title: t(ConversationExportI18nKeys.FailedTitle),
              message: t(ConversationExportI18nKeys.FailedAll),
            });
          }
          updateJob(jobId, { status: ExportJobStatus.Failed });
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
          const conversation = (await getConversation(
            toApiConversationPath(ref.id),
            signal,
          )) as Conversation;
          conversations.push(conversation);
        } catch (error) {
          if (signal.aborted) return;
          const classification = classifyExportError(error);
          if (classification.isUnauthorized) {
            updateJob(jobId, { status: ExportJobStatus.Failed });
            return;
          }
          if (classification.isNotFound) {
            showNotification({
              variant: NotificationVariant.Error,
              title: t(ConversationExportI18nKeys.FailedTitle),
              message: t(ConversationExportI18nKeys.FailedSingle, {
                title: ref.title,
              }),
            });
            console.error(
              'Skipped a conversation during export-all: not found',
              error,
            );
            continue;
          }
          showNotification({
            variant: NotificationVariant.Error,
            title: t(ConversationExportI18nKeys.FailedTitle),
            message: t(ConversationExportI18nKeys.FailedAll),
          });
          updateJob(jobId, { status: ExportJobStatus.Failed });
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
        showNotification({
          variant: NotificationVariant.Success,
          title: t(ConversationExportI18nKeys.SuccessTitle),
          message: t(ConversationExportI18nKeys.SuccessAll),
        });
        updateJob(jobId, { status: ExportJobStatus.Success });
      } catch (error) {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(ConversationExportI18nKeys.FailedTitle),
          message: t(ConversationExportI18nKeys.FailedAll),
        });
        updateJob(jobId, { status: ExportJobStatus.Failed });
        console.error('Failed to build export-all archive', error);
      }
    },
    [showNotification, t, updateJob],
  );

  const exportAll = useCallback((): Promise<void> => {
    const label = t(ConversationExportI18nKeys.AllConversationsJobLabel);
    const jobId = addJob(label);
    const run = (): Promise<void> => {
      const controller = new AbortController();
      controllersRef.current.set(jobId, controller);
      return runExportAll(jobId, controller.signal);
    };
    retryFnsRef.current.set(jobId, () => {
      updateJob(jobId, { status: ExportJobStatus.InProgress });
      return run();
    });
    return run();
  }, [addJob, runExportAll, t, updateJob]);

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

  return { jobs, exportSingle, exportAll, dismissJob, retryJob, dismissAll };
};
