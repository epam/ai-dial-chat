import {
  type TransferQueueItem,
  TransferQueueItemStatus,
} from '@epam/ai-dial-ui-kit';
import {
  ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  type ConversationTransferWarningCode,
} from '../models/conversation-transfer';
/** Resolves the translated reason shown on a failed or warned queue row. */
export interface TransferQueueMessageResolvers {
  /** Resolves a failure code, including an absent code. */
  getErrorMessage: (code: ConversationTransferErrorCode | undefined) => string;
  /** Resolves a warning code and optional affected names. */
  getWarningMessage: (
    code: ConversationTransferWarningCode | undefined,
    names?: string[],
  ) => string;
}

/**
 * Maps export/import jobs onto the UI kit's `TransferQueue` rows. A row is
 * identified by its file name; the failure or warning reason is resolved here
 * because the kit knows nothing about transfer error codes.
 */
export const toConversationTransferQueueItems = (
  jobs: readonly ConversationTransferJob[],
  { getErrorMessage, getWarningMessage }: TransferQueueMessageResolvers,
): TransferQueueItem[] => {
  const TRANSFER_QUEUE_STATUS: Record<
    ConversationTransferJobStatus,
    TransferQueueItemStatus
  > = {
    [ConversationTransferJobStatus.InProgress]:
      TransferQueueItemStatus.InProgress,
    [ConversationTransferJobStatus.Success]: TransferQueueItemStatus.Success,
    [ConversationTransferJobStatus.Warning]: TransferQueueItemStatus.Warning,
    [ConversationTransferJobStatus.Failed]: TransferQueueItemStatus.Failed,
    [ConversationTransferJobStatus.Canceled]: TransferQueueItemStatus.Canceled,
  };

  return jobs.map((job) => {
    let message: string | undefined;
    if (job.status === ConversationTransferJobStatus.Failed) {
      message = getErrorMessage(job.errorCode);
    } else if (job.status === ConversationTransferJobStatus.Warning) {
      message = getWarningMessage(job.warningCode, job.warningNames);
    }

    return {
      id: job.id,
      name: job.fileName,
      status: TRANSFER_QUEUE_STATUS[job.status],
      percent: job.progress.percent,
      message,
    };
  });
};
