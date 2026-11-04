import { ResponseError } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  safeDecodeURIComponent,
  useImportFilePicker,
} from '@epam/ai-dial-chat-hooks';
import {
  ConversationTransferWarningCode,
  useConversationExport,
  useConversationImport,
  type ConversationTransferErrorEvent,
  type ConversationTransferSuccessEvent,
  type ConversationTransferWarningEvent,
} from '@epam/ai-dial-chat-hooks/conversation-transfer';
import {
  ConversationTransferErrorCode,
  toConversationTransferQueueItems as toTransferQueueItems,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import { type TransferQueueLabels } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeConversationId } from '../../constants/routes';
import {
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';
import { useTransferQueueLabels } from '../../hooks/useTransferQueueLabels';
import { conversationsApi, filesApi } from '../../server-api/api-client';
import { UnauthorizedError } from '../../server-api/base';
import {
  formatTransferNameList,
  getExportErrorKey,
  getExportFailureToastKey,
  getImportErrorKey,
} from '../../utils/conversation-transfer';

/*
 * Desktop-only filter. Mobile file pickers match `accept` against the MIME type
 * the storage provider reports rather than the extension, and exported `.dial`
 * archives are handed over as `application/octet-stream` — so an accept list
 * greys out the very archive the user is trying to import. Mobile gets an
 * unfiltered picker instead; `useConversationImport` validates the file itself
 * and reports unparsable ones through the import queue.
 */
const IMPORT_FILE_ACCEPT = '.json,.dial,.zip,application/json,application/zip';

/**
 * Conversation export and import for the conversation panel: the transfer
 * jobs, their success/warning/error toasts, export-all, the import file
 * picker, and the view models of the two transfer queues. Reads the
 * conversations, notification, user and i18n contexts itself.
 */
export const useConversationTransfer = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
  } = useNotification();
  const { user } = useUser();
  const { refreshConversations } = useConversations();

  const classifyTransferError = useCallback((error: unknown) => {
    if (error instanceof UnauthorizedError) return { isUnauthorized: true };
    if (error instanceof ResponseError && error.response.status === 404) {
      return { isNotFound: true };
    }
    return {};
  }, []);
  const resolveErrorTraceId = useCallback(
    async (error: unknown) => (await getApiErrorDetails(error)).traceId,
    [],
  );
  const normalizeConversationPath = useCallback(
    (conversationId: string) =>
      safeDecodeURIComponent(normalizeConversationId(conversationId)),
    [],
  );

  const handleExportSuccess = useCallback(
    (event: ConversationTransferSuccessEvent) => {
      showSuccessNotification({
        title: t(ConversationExportI18nKeys.SuccessTitle),
        message: event.titles?.length
          ? t(ConversationExportI18nKeys.SuccessSingle, {
              title: event.titles[0],
            })
          : t(ConversationExportI18nKeys.SuccessAll),
      });
    },
    [showSuccessNotification, t],
  );
  const handleExportWarning = useCallback(
    (event: ConversationTransferWarningEvent) => {
      if (event.code !== ConversationTransferWarningCode.AttachmentSkipped) {
        return;
      }
      showWarningNotification({
        message: t(ConversationExportI18nKeys.WarningAttachmentSkipped),
      });
    },
    [showWarningNotification, t],
  );
  const handleExportError = useCallback(
    (event: ConversationTransferErrorEvent) => {
      if (event.code === ConversationTransferErrorCode.Unauthorized) return;
      const title = event.titles?.[0];
      showErrorNotification({
        title: t(ConversationExportI18nKeys.FailedTitle),
        message: t(getExportFailureToastKey(event.code, title != null), {
          title,
        }),
        requestId: event.traceId,
      });
    },
    [showErrorNotification, t],
  );

  const {
    jobs: exportJobs,
    exportSingle,
    exportAll,
    cancelJob: cancelExportJob,
    dismissAll: dismissAllExports,
  } = useConversationExport({
    conversationsApi,
    filesApi,
    normalizeConversationPath,
    classifyTransferError,
    resolveErrorTraceId,
    onSuccess: handleExportSuccess,
    onWarning: handleExportWarning,
    onError: handleExportError,
  });

  const handleImportSuccess = useCallback(
    (event: ConversationTransferSuccessEvent) => {
      showSuccessNotification({
        title: t(ConversationImportI18nKeys.SuccessTitle),
        message: t(ConversationImportI18nKeys.Success, {
          names: formatTransferNameList(event.titles ?? [], t),
        }),
      });
    },
    [showSuccessNotification, t],
  );
  const handleImportWarning = useCallback(
    (event: ConversationTransferWarningEvent) => {
      if (event.code !== ConversationTransferWarningCode.AttachmentSkipped) {
        return;
      }
      showWarningNotification({
        message: t(ConversationImportI18nKeys.WarningAttachmentSkipped, {
          names: formatTransferNameList(event.names ?? [], t),
        }),
      });
    },
    [showWarningNotification, t],
  );
  const handleImportError = useCallback(
    (event: ConversationTransferErrorEvent) => {
      if (event.code === ConversationTransferErrorCode.UnsupportedFormat) {
        showErrorNotification({
          title: t(ConversationImportI18nKeys.FailedTitle),
          message: t(ConversationImportI18nKeys.UnsupportedFormat),
        });
        return;
      }
      if (
        event.code === ConversationTransferErrorCode.Unauthorized ||
        event.code === ConversationTransferErrorCode.MissingBucket
      ) {
        return;
      }
      showErrorNotification({
        title: t(ConversationImportI18nKeys.FailedTitle),
        message: t(ConversationImportI18nKeys.Failed, {
          names: formatTransferNameList(event.titles ?? [], t),
        }),
        requestId: event.traceId,
      });
    },
    [showErrorNotification, t],
  );

  const {
    jobs: importJobs,
    importConversations,
    cancelJob: cancelImportJob,
    dismissAll: dismissAllImports,
  } = useConversationImport({
    conversationsApi,
    filesApi,
    bucket: user?.bucket,
    onImported: refreshConversations,
    classifyTransferError,
    resolveErrorTraceId,
    onSuccess: handleImportSuccess,
    onWarning: handleImportWarning,
    onError: handleImportError,
  });

  const handleExportAll = useCallback(() => {
    void exportAll();
  }, [exportAll]);

  const handleFileSelected = useCallback(
    (file: File) => void importConversations(file),
    [importConversations],
  );

  const {
    inputRef: importFileInputRef,
    triggerImport: handleImportClick,
    handleFileChange: handleImportFileChange,
  } = useImportFilePicker({
    accept: isMobile ? undefined : IMPORT_FILE_ACCEPT,
    onFileSelected: handleFileSelected,
  });

  const exportQueueTitle = t(ConversationExportI18nKeys.QueueTitle, {
    count: exportJobs.length,
  });
  const importQueueTitle = t(ConversationImportI18nKeys.QueueTitle, {
    count: importJobs.length,
  });

  const sharedQueueLabels = useTransferQueueLabels();

  const exportQueueLabels = useMemo<Partial<TransferQueueLabels>>(
    () => ({
      ...sharedQueueLabels,
      cancelItemAriaLabel: (fileName) =>
        t(ConversationExportI18nKeys.CancelJobAriaLabel, { fileName }),
      itemProgressAriaLabel: (fileName) =>
        t(ConversationExportI18nKeys.JobProgressAriaLabel, { fileName }),
      failedMessage: t(ConversationExportI18nKeys.ErrorUnknown),
      warningMessage: t(ConversationExportI18nKeys.WarningAttachmentSkipped),
      queueProgressAriaLabel: t(
        ConversationExportI18nKeys.QueueProgressAriaLabel,
      ),
    }),
    [sharedQueueLabels, t],
  );

  const importQueueLabels = useMemo<Partial<TransferQueueLabels>>(
    () => ({
      ...sharedQueueLabels,
      cancelItemAriaLabel: (fileName) =>
        t(ConversationImportI18nKeys.CancelJobAriaLabel, { fileName }),
      itemProgressAriaLabel: (fileName) =>
        t(ConversationImportI18nKeys.JobProgressAriaLabel, { fileName }),
      failedMessage: t(ConversationImportI18nKeys.ErrorUnknown),
      warningMessage: t(ConversationImportI18nKeys.JobWarningAttachmentSkipped),
      queueProgressAriaLabel: t(
        ConversationImportI18nKeys.QueueProgressAriaLabel,
      ),
    }),
    [sharedQueueLabels, t],
  );

  const exportQueueItems = useMemo(
    () =>
      toTransferQueueItems(exportJobs, {
        getErrorMessage: (code) => t(getExportErrorKey(code)),
        getWarningMessage: () =>
          t(ConversationExportI18nKeys.WarningAttachmentSkipped),
      }),
    [exportJobs, t],
  );

  const importQueueItems = useMemo(
    () =>
      toTransferQueueItems(importJobs, {
        getErrorMessage: (code) => t(getImportErrorKey(code)),
        getWarningMessage: (_code, names) =>
          names?.length
            ? t(ConversationImportI18nKeys.WarningAttachmentSkipped, {
                names: formatTransferNameList(names, t),
              })
            : t(ConversationImportI18nKeys.JobWarningAttachmentSkipped),
      }),
    [importJobs, t],
  );

  return {
    exportSingle,
    handleExportAll,
    handleImportClick,
    importFileInputRef,
    handleImportFileChange,
    exportQueueTitle,
    importQueueTitle,
    exportQueueLabels,
    importQueueLabels,
    exportQueueItems,
    importQueueItems,
    cancelExportJob,
    cancelImportJob,
    dismissAllExports,
    dismissAllImports,
  };
};
