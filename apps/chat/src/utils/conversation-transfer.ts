import { formatQuotedNameList } from '@epam/ai-dial-chat-hooks/conversation-transfer';
import {
  ConversationTransferErrorCode,
  type ConversationTransferJob,
  ConversationTransferJobStatus,
  type ConversationTransferWarningCode,
} from '@epam/ai-dial-chat-shared';
import {
  type TransferQueueItem,
  TransferQueueItemStatus,
} from '@epam/ai-dial-ui-kit';
import type { TFunction } from 'i18next';
import {
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
} from '../constants/translation-keys';

/**
 * How many names an import notification spells out before the remainder is
 * summarized as a count.
 */
export const TRANSFER_NAME_LIST_LIMIT = 5;

/**
 * Returns a quoted, comma-separated list of at most `TRANSFER_NAME_LIST_LIMIT`
 * names, with any remainder folded into a trailing count. A whole archive's
 * worth of conversation or attachment names would otherwise grow the
 * notification past the height of the page.
 */
export const formatTransferNameList = (
  names: string[],
  t: TFunction,
): string => {
  const visibleNames = names.slice(0, TRANSFER_NAME_LIST_LIMIT);
  const restCount = names.length - visibleNames.length;
  const visibleList = formatQuotedNameList(visibleNames);

  if (restCount <= 0) return visibleList;

  return t(ConversationImportI18nKeys.NameListWithRest, {
    names: visibleList,
    count: restCount,
  });
};

/**
 * Returns the key for the message shown in a failed export row's tooltip.
 * Codes the export flow never raises fall back to the generic message.
 */
export const getExportErrorKey = (
  code: ConversationTransferErrorCode | undefined,
): ConversationExportI18nKeys => {
  switch (code) {
    case ConversationTransferErrorCode.Unauthorized:
      return ConversationExportI18nKeys.ErrorUnauthorized;
    case ConversationTransferErrorCode.NotFound:
      return ConversationExportI18nKeys.ErrorNotFound;
    case ConversationTransferErrorCode.FileTooLarge:
      return ConversationExportI18nKeys.ErrorFileTooLarge;
    default:
      return ConversationExportI18nKeys.ErrorUnknown;
  }
};

/**
 * Returns the key for the message shown in a failed import row's tooltip.
 * Codes the import flow never raises fall back to the generic message.
 */
export const getImportErrorKey = (
  code: ConversationTransferErrorCode | undefined,
): ConversationImportI18nKeys => {
  switch (code) {
    case ConversationTransferErrorCode.Unauthorized:
      return ConversationImportI18nKeys.ErrorUnauthorized;
    case ConversationTransferErrorCode.MissingBucket:
      return ConversationImportI18nKeys.ErrorMissingBucket;
    case ConversationTransferErrorCode.UnsupportedFormat:
      return ConversationImportI18nKeys.ErrorUnsupportedFormat;
    default:
      return ConversationImportI18nKeys.ErrorUnknown;
  }
};

/**
 * Returns the key for the export failure toast. A named conversation gets the
 * per-title message — the too-large variant when that is the reason — while an
 * export-all failure gets the generic one.
 */
export const getExportFailureToastKey = (
  code: ConversationTransferErrorCode | undefined,
  hasTitle: boolean,
): ConversationExportI18nKeys => {
  if (!hasTitle) return ConversationExportI18nKeys.FailedAll;
  if (code === ConversationTransferErrorCode.FileTooLarge) {
    return ConversationExportI18nKeys.FailedSingleTooLarge;
  }
  return ConversationExportI18nKeys.FailedSingle;
};

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

/** Resolves the translated reason shown on a failed or warned queue row. */
export interface TransferQueueMessageResolvers {
  getErrorMessage: (code: ConversationTransferErrorCode | undefined) => string;
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
export const toTransferQueueItems = (
  jobs: ConversationTransferJob[],
  { getErrorMessage, getWarningMessage }: TransferQueueMessageResolvers,
): TransferQueueItem[] =>
  jobs.map((job) => {
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
