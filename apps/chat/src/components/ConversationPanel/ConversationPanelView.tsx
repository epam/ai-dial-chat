import {
  ResponseError,
  type ConversationListItemDto,
  type DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  deriveConversationRowActionState,
  getApiErrorDetails,
  getConversationPath,
  safeDecodeURIComponent,
  useActiveConversationSync,
  useAsyncConfirmDialog,
  useConversationLookupMaps,
  useConversationPanelItems,
  useImportFilePicker,
} from '@epam/ai-dial-chat-hooks';
import {
  ConversationExportMode,
  type ConversationTransferErrorEvent,
  type ConversationTransferSuccessEvent,
  ConversationTransferWarningCode,
  type ConversationTransferWarningEvent,
  formatQuotedNameList,
  useConversationExport,
  useConversationImport,
} from '@epam/ai-dial-chat-hooks/conversation-transfer';
import { useShareRecipientsCount } from '@epam/ai-dial-chat-hooks/sharing';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  ConversationTransferErrorCode,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  ConversationPanel,
  ImportExportQueue,
  RenameConversationPopup,
  type ConversationItem,
  type ConversationMove,
  type ConversationPanelStyles,
  type ImportExportQueueLabels,
  type RenameConversationPopupLabels,
} from '@epam/ai-dial-conversation-panel';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Popup,
  PopupSize,
  RadioGroup,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconCopy,
  IconDownload,
  IconPencilMinus,
  IconPin,
  IconPinnedFilled,
  IconShare,
  IconTrashX,
  IconUserOff,
  IconWorldOff,
  IconWorldShare,
} from '@tabler/icons-react';
import { memo, useCallback, useMemo, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  getConversationRoute,
  normalizeConversationId,
} from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
  ConversationPanelI18nKeys,
  ConversationUnpublishI18nKeys,
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLanguage } from '../../hooks/language/useLanguage';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { useConversationPublishHistory } from '../../hooks/useConversationPublishHistory/useConversationPublishHistory';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUiFeature } from '../../hooks/useUiFeature';
import {
  conversationsApi,
  filesApi,
  shareApi,
} from '../../server-api/api-client';
import { UnauthorizedError } from '../../server-api/base';
import { unpublishConversation } from '../../server-api/conversation-publish.api';
import {
  discardSharedCatalogItem,
  revokeSharedAccess,
} from '../../server-api/share.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { PublishHistoryStatus } from '../../types/publish-history';
import { ROUTES } from '../../types/routes';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../../utils/conversation-id-match';
import {
  getExportErrorKey,
  getExportFailureToastKey,
  getImportErrorKey,
} from '../../utils/conversation-transfer';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import PublishConversationPanelContainer from '../PublishConversationPanelContainer/PublishConversationPanelContainer';
import ShareConversationPopoverContainer from '../ShareConversationPopoverContainer/ShareConversationPopoverContainer';
import ConversationPanelMenu from './ConversationPanelMenu';

const PANEL_STYLES: ConversationPanelStyles = {
  itemIconBadgeClassName: 'rounded-lg',
};

/*
 * Desktop-only filter. Mobile file pickers match `accept` against the MIME type
 * the storage provider reports rather than the extension, and exported `.dial`
 * archives are handed over as `application/octet-stream` — so an accept list
 * greys out the very archive the user is trying to import. Mobile gets an
 * unfiltered picker instead; `useConversationImport` validates the file itself
 * and reports unparsable ones through the import queue.
 */
const IMPORT_FILE_ACCEPT = '.json,.dial,.zip,application/json,application/zip';

interface ConversationPanelViewProps {
  isOpen: boolean;
  activeConversationId?: string;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  requestedFilter?: FilterTab;
  onRequestedFilterChange?: () => void;
  onActiveFilterChange?: (tab: FilterTab) => void;
  onDuplicateReadonly?: () => void;
}

const ConversationPanelView: FC<ConversationPanelViewProps> = ({
  isOpen,
  activeConversationId,
  onClose,
  onSelectConversation,
  onNewChat,
  requestedFilter,
  onRequestedFilterChange,
  onActiveFilterChange,
  onDuplicateReadonly,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    showSuccessNotification,
    showErrorNotification,
    showWarningNotification,
  } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { user } = useUser();
  const isConversationsSectionEnabled = useUiFeature(
    OverlayFeature.ConversationsSection,
  );
  const isConversationsSharingEnabled = useUiFeature(
    OverlayFeature.ConversationsSharing,
  );
  const isConversationsPublishingEnabled = useUiFeature(
    OverlayFeature.ConversationsPublishing,
  );
  const isConversationsFilterHidden = useUiFeature(
    OverlayFeature.HideConversationsFilter,
  );
  const {
    conversations: items,
    isLoading,
    pinConversation,
    markConversationViewed,
    deleteConversation,
    renameConversation,
    generateConversationTitle,
    duplicateConversation,
    refreshConversations,
  } = useConversations();
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
          names: formatQuotedNameList(event.titles ?? []),
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
          names: formatQuotedNameList(event.names ?? []),
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
          names: formatQuotedNameList(event.titles ?? []),
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

  const { items: deployments, isLoading: isDeploymentsLoading } =
    useDeployments();

  const panelActiveConversationId = useActiveConversationSync({
    activeConversationId,
    items,
    refreshConversations,
    markConversationViewed,
    conversationIdsMatch,
    toPanelConversationId,
  });

  const {
    pending: pendingDeleteId,
    isPending: isDeletePending,
    isRunning: isDeleting,
    error: deleteError,
    open: openDeleteDialog,
    close: closeDeleteDialog,
    confirm: confirmDeleteDialog,
  } = useAsyncConfirmDialog<string>();
  const {
    pending: pendingUnshareId,
    isPending: isUnsharePending,
    isRunning: isUnsharing,
    error: unshareError,
    open: openUnshareDialog,
    close: closeUnshareDialog,
    confirm: confirmUnshareDialog,
  } = useAsyncConfirmDialog<string>();
  const {
    pending: pendingRevokeId,
    isPending: isRevokePending,
    isRunning: isRevoking,
    error: revokeError,
    open: openRevokeDialog,
    close: closeRevokeDialog,
    confirm: confirmRevokeDialog,
  } = useAsyncConfirmDialog<string>();
  const {
    pending: pendingRename,
    isPending: isRenamePending,
    isRunning: isRenaming,
    error: renameError,
    open: openRenameDialog,
    close: closeRenameDialog,
    confirm: confirmRenameDialog,
  } = useAsyncConfirmDialog<{ id: string; title: string }>();
  const {
    pending: pendingUnpublish,
    isPending: isUnpublishPending,
    isRunning: isUnpublishing,
    open: openUnpublishDialog,
    close: closeUnpublishDialog,
    confirm: confirmUnpublishDialog,
  } = useAsyncConfirmDialog<{
    path: string;
    title: string;
    folders: string[];
  }>();
  /* Set only when the conversation is published to more than one folder. */
  const [selectedUnpublishFolder, setSelectedUnpublishFolder] = useState<
    string | null
  >(null);

  const [pendingShareConversationPath, setPendingShareConversationPath] =
    useState<string | null>(null);

  const [pendingPublishConversation, setPendingPublishConversation] = useState<{
    path: string;
    title: string;
  } | null>(null);
  const publishReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  const {
    requestRecipientsCount,
    getRecipientsCount,
    invalidateRecipientsCount,
  } = useShareRecipientsCount(shareApi);
  const { requestPublishHistory, getPublishHistory } =
    useConversationPublishHistory();
  const showPublishError = usePublishErrorNotification();

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

  /*
   * Both queues share the direction-agnostic chrome (collapse/expand/close,
   * the close-confirmation copy and the "Canceled" label), so those strings
   * live once under the export key set rather than being duplicated under the
   * import one.
   */
  const sharedQueueLabels = useMemo(
    () => ({
      canceledLabel: t(ConversationExportI18nKeys.CanceledLabel),
      collapseQueueAriaLabel: t(
        ConversationExportI18nKeys.CollapseQueueAriaLabel,
      ),
      expandQueueAriaLabel: t(ConversationExportI18nKeys.ExpandQueueAriaLabel),
      closeQueueAriaLabel: t(ConversationExportI18nKeys.CloseQueueAriaLabel),
      closeQueueConfirmHeader: t(
        ConversationExportI18nKeys.CloseQueueConfirmHeader,
      ),
      closeQueueConfirmDescriptionInProgress: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionInProgress,
      ),
      closeQueueConfirmDescriptionFailed: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionFailed,
      ),
      closeQueueConfirmDescriptionMixed: t(
        ConversationExportI18nKeys.CloseQueueConfirmDescriptionMixed,
      ),
      closeLabel: t(ButtonsI18nKeys.Close),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      queueProgressValueText: (completed: number, total: number) =>
        t(ConversationExportI18nKeys.QueueProgressValueText, {
          completed,
          count: total,
        }),
    }),
    [t],
  );

  const exportQueueLabels = useMemo<ImportExportQueueLabels>(
    () => ({
      ...sharedQueueLabels,
      cancelJobAriaLabel: (fileName) =>
        t(ConversationExportI18nKeys.CancelJobAriaLabel, { fileName }),
      jobProgressAriaLabel: (fileName) =>
        t(ConversationExportI18nKeys.JobProgressAriaLabel, { fileName }),
      jobErrorMessage: (code) => t(getExportErrorKey(code)),
      jobWarningMessage: () =>
        t(ConversationExportI18nKeys.WarningAttachmentSkipped),
      queueProgressAriaLabel: t(
        ConversationExportI18nKeys.QueueProgressAriaLabel,
      ),
    }),
    [sharedQueueLabels, t],
  );

  const importQueueLabels = useMemo<ImportExportQueueLabels>(
    () => ({
      ...sharedQueueLabels,
      cancelJobAriaLabel: (fileName) =>
        t(ConversationImportI18nKeys.CancelJobAriaLabel, { fileName }),
      jobProgressAriaLabel: (fileName) =>
        t(ConversationImportI18nKeys.JobProgressAriaLabel, { fileName }),
      jobErrorMessage: (code) => t(getImportErrorKey(code)),
      jobWarningMessage: () =>
        t(ConversationImportI18nKeys.WarningAttachmentSkipped),
      queueProgressAriaLabel: t(
        ConversationImportI18nKeys.QueueProgressAriaLabel,
      ),
    }),
    [sharedQueueLabels, t],
  );

  const renameLabels = useMemo<RenameConversationPopupLabels>(
    () => ({
      popupTitle: t(ConversationPanelI18nKeys.RenameTitle),
      inputPlaceholder: t(ConversationPanelI18nKeys.RenameInputPlaceholder),
      renameWithAiLabel: t(ConversationPanelI18nKeys.RenameWithAiLabel),
      renameWithAiError: t(ConversationPanelI18nKeys.RenameWithAiError),
      nameTooLongError: t(ConversationPanelI18nKeys.RenameTitleTooLong),
      saveLabel: t(ButtonsI18nKeys.Save),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  /** Map panel id → context id for reverse lookup */
  const { toContextId, getRawItem } = useConversationLookupMaps({
    items,
    toPanelConversationId,
  });

  const taskBadgeLabel = t(ConversationPanelI18nKeys.TaskBadgeLabel);
  const unreadIndicatorLabel = t(
    ConversationPanelI18nKeys.UnreadIndicatorLabel,
  );

  const resolveIconUrl = useCallback(
    (deployment: DeploymentItemDto | undefined) =>
      deployment?.iconUrl
        ? resolveCatalogIconUrl(deployment.iconUrl)
        : undefined,
    [],
  );

  const resolveIconTooltip = useCallback(
    (deployment: DeploymentItemDto | undefined, fallback: string) =>
      deployment
        ? resolveLocalizedText(deployment.displayName, language)
        : fallback || undefined,
    [language],
  );

  const resolveHref = useCallback((id: string) => getConversationRoute(id), []);

  const resolveTaskBadge = useCallback(
    (item: ConversationListItemDto) =>
      item.isScheduledTask
        ? { label: taskBadgeLabel, isUnread: item.isUnread ?? false }
        : undefined,
    [taskBadgeLabel],
  );

  const conversations = useConversationPanelItems({
    items,
    deployments,
    isDeploymentsLoading,
    toPanelConversationId,
    resolveIconUrl,
    resolveIconTooltip,
    resolveHref,
    resolveTaskBadge,
  });

  const filterLabels = useMemo(
    () => ({
      all: t(ConversationPanelI18nKeys.FilterAll),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(BasicI18nKeys.Organization),
      groupAriaLabel: t(ConversationPanelI18nKeys.FilterGroupAriaLabel),
    }),
    [t],
  );

  const groupLabels = useMemo(
    () => ({
      pinned: t(ConversationPanelI18nKeys.PinnedSection),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(BasicI18nKeys.Organization),
    }),
    [t],
  );

  const handleMoveConversation = useCallback(
    ({ draggedId, targetGroupKey }: ConversationMove) => {
      const contextId = toContextId(draggedId);
      if (!contextId) return;

      const draggedItem = conversations.find((c) => c.id === draggedId);
      if (!draggedItem) return;

      if (targetGroupKey === FilterTab.Pinned) {
        void pinConversation(contextId, true);
      } else if (draggedItem.isPinned) {
        void pinConversation(contextId, false);
      }
      // Same-group reorder: no API available in this iteration — no-op.
    },
    [toContextId, conversations, pinConversation],
  );

  /*
   * The row's recipient count is fetched here rather than carried on the list
   * items: it only matters at the moment the owner is about to act on it, and a
   * snapshot from the list fetch would still offer "Revoke access (3)" right
   * after those three grants were revoked.
   */
  const handleActionMenuOpen = useCallback(
    (item: ConversationItem, trigger: HTMLButtonElement) => {
      publishReturnFocusRef.current = trigger;

      const contextId = toContextId(item.id);
      if (!contextId) return;

      /* Only an owned, writable row can offer revoking or unpublishing, so
       * only those need either lookup. */
      const rawItem = getRawItem(item.id);
      if (
        rawItem?.isReadonly ||
        rawItem?.sharedWithMe ||
        rawItem?.publishedWithMe
      ) {
        return;
      }
      if (isConversationsSharingEnabled) {
        requestRecipientsCount(contextId);
      }
      /*
       * Keyed by the same bucket-relative path the publish and unpublish
       * requests use, so the publish panel opened next reuses this result.
       */
      if (isConversationsPublishingEnabled) {
        requestPublishHistory(
          getConversationPath(normalizeConversationId(contextId)),
        );
      }
    },
    [
      toContextId,
      getRawItem,
      isConversationsSharingEnabled,
      isConversationsPublishingEnabled,
      requestRecipientsCount,
      requestPublishHistory,
    ],
  );

  const getActions = useCallback(
    (panelItem: ConversationItem): DropdownItem[] => {
      const contextId = toContextId(panelItem.id);
      if (!contextId) return [];

      const rawItem = getRawItem(panelItem.id);
      const conversationPath = getConversationPath(
        normalizeConversationId(contextId),
      );
      const history = getPublishHistory(conversationPath);
      const recipients = getRecipientsCount(contextId);

      const {
        isReadonly: isReadonlyItem,
        publishedFolders,
        isRevokeVisible,
      } = deriveConversationRowActionState(
        {
          sharedWithMe: rawItem?.sharedWithMe ?? false,
          publishedWithMe: rawItem?.publishedWithMe ?? false,
          isReadonly: rawItem?.isReadonly ?? false,
        },
        history.status === PublishHistoryStatus.Resolved
          ? history.entries
          : undefined,
        recipients,
      );

      const pinAction: DropdownItem = {
        key: 'pin',
        label: panelItem.isPinned
          ? t(ConversationPanelI18nKeys.UnpinLabel)
          : t(ConversationPanelI18nKeys.PinLabel),
        icon: panelItem.isPinned ? (
          <IconPinnedFilled
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
          />
        ) : (
          <IconPin
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: () => pinConversation(contextId, !panelItem.isPinned),
      };

      const duplicateAction: DropdownItem = {
        key: 'duplicate',
        label: t(ButtonsI18nKeys.Duplicate),
        icon: (
          <IconCopy
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        onClick: async () => {
          try {
            const newPath = await duplicateConversation(contextId);
            if (
              isReadonlyItem &&
              panelActiveConversationId &&
              conversationIdsMatch(panelItem.id, panelActiveConversationId)
            ) {
              onDuplicateReadonly?.();
            }
            notifyOperationSuccess(
              NotifiableEntity.Conversation,
              EntityOperation.Duplicated,
              { name: panelItem.title },
            );
            navigate(getConversationRoute(newPath));
          } catch (error) {
            const { traceId } = await getApiErrorDetails(error);
            showErrorNotification({
              message: t(ConversationPanelI18nKeys.DuplicateError),
              requestId: traceId,
            });
          }
        },
      };

      const startExport = (mode: ConversationExportMode) => {
        void exportSingle(contextId, panelItem.title, mode);
      };

      const exportAction: DropdownItem = {
        key: 'export',
        label: t(ConversationExportI18nKeys.ExportLabel),
        icon: (
          <IconDownload
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
            stroke={DIAL_KIT_ICON_STROKE}
          />
        ),
        children: [
          {
            key: 'export-with-attachments',
            label: t(ConversationExportI18nKeys.WithAttachmentsOption),
            onClick: () => startExport(ConversationExportMode.WithAttachments),
          },
          {
            key: 'export-without-attachments',
            label: t(ConversationExportI18nKeys.WithoutAttachmentsOption),
            onClick: () =>
              startExport(ConversationExportMode.WithoutAttachments),
          },
        ],
      };

      if (isReadonlyItem) {
        const readonlyActions = [pinAction, duplicateAction, exportAction];
        if (rawItem?.sharedWithMe) {
          readonlyActions.push({
            key: 'unshare',
            label: t(ButtonsI18nKeys.RemoveFromMyList),
            icon: (
              <IconTrashX
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            ),
            onClick: () => openUnshareDialog(contextId),
          });
        }
        return readonlyActions;
      }

      return [
        pinAction,
        {
          key: 'rename',
          label: t(ButtonsI18nKeys.Rename),
          icon: (
            <IconPencilMinus
              size={DIAL_ICON_SIZE.SM}
              className="text-secondary"
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          onClick: () =>
            openRenameDialog({ id: contextId, title: panelItem.title }),
        },
        duplicateAction,
        exportAction,
        ...(isConversationsSharingEnabled
          ? [
              {
                key: 'share',
                label: t(ShareI18nKeys.Title),
                icon: (
                  <IconShare
                    size={DIAL_ICON_SIZE.SM}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () => setPendingShareConversationPath(contextId),
              },
            ]
          : []),
        /*
         * "Publish" and "Unpublish" are mutually exclusive: the row menu offers
         * whichever one matches the conversation's current state, never both.
         * A conversation with no published copy offers "Publish"; once history
         * resolves to at least one published folder, "Unpublish" takes its
         * place. Republishing an already-published conversation therefore means
         * unpublishing it first — the trade the single-state menu buys.
         */
        ...(isConversationsPublishingEnabled && publishedFolders.length === 0
          ? [
              {
                key: 'publish',
                label: t(ButtonsI18nKeys.Publish),
                icon: (
                  <IconWorldShare
                    size={DIAL_ICON_SIZE.SM}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                /*
                 * Unlike Share's itemId (which wants the full `conversations/{bucket}/{name}`
                 * resource path), the publish endpoint's `path` query param follows the
                 * rename/delete/duplicate convention — bucket-relative, no `conversations/`
                 * prefix — so it must be stripped here (see conversation-publish.service.ts).
                 */
                onClick: () =>
                  setPendingPublishConversation({
                    path: getConversationPath(
                      normalizeConversationId(contextId),
                    ),
                    title: panelItem.title,
                  }),
              },
            ]
          : []),
        /*
         * Withheld until the publish-history lookup started by this menu's
         * open settles, and hidden on zero folders or on failure: unpublish
         * needs the folder itself to build the request, so an entry shown
         * without one could not do anything if clicked. While it is withheld
         * "Publish" holds the slot, so the menu can swap one for the other as
         * the lookup lands.
         */
        ...(isConversationsPublishingEnabled && publishedFolders.length > 0
          ? [
              {
                key: 'unpublish',
                label: t(ButtonsI18nKeys.Unpublish),
                icon: (
                  <IconWorldOff
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () => {
                  setSelectedUnpublishFolder(null);
                  openUnpublishDialog({
                    path: conversationPath,
                    title: panelItem.title,
                    folders: publishedFolders,
                  });
                },
              },
            ]
          : []),
        /*
         * Revoking cuts off every recipient of an owned conversation. It rides
         * the same feature flag as Share: with sharing disabled there is no way
         * to grant access, so offering to revoke it would be incoherent.
         *
         * The recipient count is requested when this menu opens, so it is never
         * a stale list snapshot. The entry is withheld until the lookup settles
         * and stays hidden once nobody holds access; a lookup that could not
         * produce a number still shows it, so a transient failure never removes
         * the only way to revoke.
         */
        ...(isConversationsSharingEnabled && isRevokeVisible
          ? [
              {
                key: 'revoke-access',
                label:
                  recipients.count == null
                    ? t(ButtonsI18nKeys.RevokeAccess)
                    : t(ButtonsI18nKeys.RevokeAccessWithCount, {
                        count: recipients.count,
                      }),
                icon: (
                  <IconUserOff
                    size={DIAL_ICON_SIZE.SM}
                    className="text-secondary"
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
                onClick: () => openRevokeDialog(contextId),
              },
            ]
          : []),
        {
          key: 'delete',
          label: t(ButtonsI18nKeys.Delete),
          icon: (
            <IconTrashX
              size={DIAL_ICON_SIZE.SM}
              className="text-error"
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          className: 'text-error',
          onClick: () => openDeleteDialog(contextId),
        },
      ];
    },
    [
      toContextId,
      getRawItem,
      t,
      pinConversation,
      duplicateConversation,
      panelActiveConversationId,
      isConversationsSharingEnabled,
      isConversationsPublishingEnabled,
      getPublishHistory,
      navigate,
      onDuplicateReadonly,
      notifyOperationSuccess,
      showErrorNotification,
      exportSingle,
      getRecipientsCount,
      openDeleteDialog,
      openUnshareDialog,
      openRevokeDialog,
      openRenameDialog,
      openUnpublishDialog,
    ],
  );

  const handleCloseSharePopover = useCallback(() => {
    setPendingShareConversationPath(null);
  }, []);

  /*
   * Already fetched when the row's action menu opened, so opening the publish
   * panel next issues no second request.
   */
  const publishPanelHistory = getPublishHistory(
    pendingPublishConversation?.path ?? '',
  );

  const unpublishFolders = pendingUnpublish?.folders ?? [];
  /* One published folder is confirmed directly; several require a pick. */
  const hasUnpublishFolderChoice = unpublishFolders.length > 1;

  const handleClosePublishPanel = useCallback(() => {
    setPendingPublishConversation(null);
  }, []);

  const pendingDeleteTitle = useMemo(() => {
    if (!pendingDeleteId) return '';
    return items.find((c) => c.id === pendingDeleteId)?.title ?? '';
  }, [items, pendingDeleteId]);

  const handleConfirmDelete = useCallback(async () => {
    await confirmDeleteDialog(
      async (idToDelete) => {
        await deleteConversation(idToDelete);
        notifyOperationSuccess(
          NotifiableEntity.Conversation,
          EntityOperation.Deleted,
          { name: pendingDeleteTitle },
        );
        if (
          panelActiveConversationId != null &&
          conversationIdsMatch(idToDelete, panelActiveConversationId)
        ) {
          navigate(ROUTES.Root);
        }
      },
      () => t(ConversationPanelI18nKeys.DeleteError),
    );
  }, [
    confirmDeleteDialog,
    pendingDeleteTitle,
    notifyOperationSuccess,
    deleteConversation,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (isDeleting) return;
    closeDeleteDialog();
  }, [isDeleting, closeDeleteDialog]);

  const pendingUnshareTitle = useMemo(() => {
    if (!pendingUnshareId) return '';
    const item = items.find((c) => c.id === pendingUnshareId);
    return item?.title ?? item?.id ?? '';
  }, [items, pendingUnshareId]);

  const handleConfirmUnshare = useCallback(async () => {
    await confirmUnshareDialog(
      async (idToUnshare) => {
        await discardSharedCatalogItem(idToUnshare);

        try {
          await refreshConversations();
        } catch {
          /* The discard already succeeded; a refresh failure must not undo that success. */
        }

        showSuccessNotification({
          title: t(ConversationPanelI18nKeys.UnshareSuccessTitle),
          message: t(ConversationPanelI18nKeys.UnshareSuccess, {
            name: pendingUnshareTitle,
          }),
        });

        if (
          panelActiveConversationId != null &&
          conversationIdsMatch(idToUnshare, panelActiveConversationId)
        ) {
          navigate(ROUTES.Root);
        }
      },
      () =>
        t(ConversationPanelI18nKeys.UnshareError, {
          name: pendingUnshareTitle,
        }),
    );
  }, [
    confirmUnshareDialog,
    pendingUnshareTitle,
    refreshConversations,
    showSuccessNotification,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseUnshareDialog = useCallback(() => {
    if (isUnsharing) return;
    closeUnshareDialog();
  }, [isUnsharing, closeUnshareDialog]);

  const pendingRevokeTitle = useMemo(() => {
    if (!pendingRevokeId) return '';
    const item = items.find((c) => c.id === pendingRevokeId);
    return item?.title ?? item?.id ?? '';
  }, [items, pendingRevokeId]);

  /*
   * Unlike unshare, revoking leaves the conversation in the owner's own list —
   * only other people lose access — so there is nothing to navigate away from.
   * `refreshConversations` runs purely so any share-derived indicator settles.
   */
  const handleCloseUnpublishDialog = useCallback(() => {
    if (isUnpublishing) return;
    closeUnpublishDialog();
    setSelectedUnpublishFolder(null);
  }, [isUnpublishing, closeUnpublishDialog]);

  const handleConfirmUnpublish = useCallback(async () => {
    await confirmUnpublishDialog(
      async ({ path, title, folders }) => {
        /* One published folder needs no choice; several require a pick, which
         * the disabled confirm button already enforces. */
        const folderPath =
          selectedUnpublishFolder != null
            ? folders.find((folder) => folder === selectedUnpublishFolder)
            : folders[0];
        if (!folderPath) return;

        try {
          await unpublishConversation(path, folderPath);
        } catch (error) {
          showPublishError(error, EntityOperation.UnpublishRequested);
          /* Swallow so confirm() calls close() instead of keeping the dialog open. */
          return;
        }

        /*
         * No `refreshConversations()`: nothing about the caller's own list
         * changed, and the published copy survives until an admin approves the
         * removal — the same reason publish success does not refresh either.
         */
        notifyOperationSuccess(
          NotifiableEntity.Conversation,
          EntityOperation.UnpublishRequested,
          { name: title, folder: folderPath.split('/').pop() ?? folderPath },
        );
      },
      () => '',
    );
    setSelectedUnpublishFolder(null);
  }, [
    confirmUnpublishDialog,
    selectedUnpublishFolder,
    showPublishError,
    notifyOperationSuccess,
  ]);

  const handleConfirmRevoke = useCallback(async () => {
    await confirmRevokeDialog(
      async (idToRevoke) => {
        await revokeSharedAccess(idToRevoke);

        /* Nobody holds access any more, so the cached count is spent: dropping it
         * makes the next menu open re-ask instead of offering to revoke again. */
        invalidateRecipientsCount(idToRevoke);

        try {
          await refreshConversations();
        } catch {
          /* The revoke already succeeded; a refresh failure must not undo that success. */
        }

        showSuccessNotification({
          title: t(ConversationPanelI18nKeys.RevokeSuccessTitle),
          message: t(ConversationPanelI18nKeys.RevokeSuccess, {
            name: pendingRevokeTitle,
          }),
        });
      },
      () =>
        t(ConversationPanelI18nKeys.RevokeError, {
          name: pendingRevokeTitle,
        }),
    );
  }, [
    confirmRevokeDialog,
    pendingRevokeTitle,
    refreshConversations,
    invalidateRecipientsCount,
    showSuccessNotification,
    t,
  ]);

  const handleCloseRevokeDialog = useCallback(() => {
    if (isRevoking) return;
    closeRevokeDialog();
  }, [isRevoking, closeRevokeDialog]);

  const handleConfirmRename = useCallback(
    async (newTitle: string) => {
      await confirmRenameDialog(
        async ({ id }) => {
          await renameConversation(id, newTitle);
          notifyOperationSuccess(
            NotifiableEntity.Conversation,
            EntityOperation.Renamed,
            { name: newTitle },
          );
        },
        () => t(ConversationPanelI18nKeys.RenameError),
      );
    },
    [confirmRenameDialog, renameConversation, notifyOperationSuccess, t],
  );

  const handleGenerateRenameWithAi = useCallback(async () => {
    if (!pendingRename) return '';
    return generateConversationTitle(pendingRename.id);
  }, [pendingRename, generateConversationTitle]);

  const handleCloseRenameDialog = useCallback(() => {
    if (isRenaming) return;
    closeRenameDialog();
  }, [isRenaming, closeRenameDialog]);

  const handleActiveFilterChange = useCallback(
    (tab: FilterTab) => {
      onRequestedFilterChange?.();
      onActiveFilterChange?.(tab);
    },
    [onRequestedFilterChange, onActiveFilterChange],
  );

  const panelClassName = isMobile
    ? mergeClasses('fixed inset-y-0 start-0', isOpen && 'z-50')
    : undefined;

  return (
    <>
      {isConversationsSectionEnabled && (
        <ConversationPanel
          conversations={conversations}
          isLoading={isLoading}
          isOpen={isOpen}
          onSelectConversation={onSelectConversation}
          activeConversationId={panelActiveConversationId}
          activeFilter={requestedFilter}
          onActiveFilterChange={handleActiveFilterChange}
          isFilterTabsHidden={isConversationsFilterHidden}
          labels={{
            title: t(ConversationPanelI18nKeys.Title),
            emptyLabel: t(ConversationPanelI18nKeys.Empty),
            noResultsLabel: t(BasicI18nKeys.NoResults),
            newChatLabel: t(ButtonsI18nKeys.NewChat),
            searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
            searchClearLabel: t(BasicI18nKeys.ClearSearch),
            filterLabels,
            groupLabels,
            actionsLabel: t(ConversationPanelI18nKeys.ActionsLabel),
            unreadIndicatorLabel,
            closeAriaLabel: t(ConversationPanelI18nKeys.ToggleAriaLabel),
          }}
          onNewChat={onNewChat}
          getActions={getActions}
          onActionMenuOpen={handleActionMenuOpen}
          onToggle={isMobile ? onClose : undefined}
          className={panelClassName}
          styles={PANEL_STYLES}
          onMoveConversation={handleMoveConversation}
          headerActions={
            <ConversationPanelMenu
              activeConversationId={activeConversationId}
              onExportAll={handleExportAll}
              onImport={handleImportClick}
            />
          }
        />
      )}

      <input
        ref={importFileInputRef}
        type="file"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleImportFileChange}
      />

      <div className="fixed bottom-4 end-4 z-[70] flex flex-col-reverse gap-2">
        <ImportExportQueue
          title={importQueueTitle}
          jobs={importJobs}
          onClose={dismissAllImports}
          onCancel={cancelImportJob}
          labels={importQueueLabels}
        />
        <ImportExportQueue
          title={exportQueueTitle}
          jobs={exportJobs}
          onClose={dismissAllExports}
          onCancel={cancelExportJob}
          labels={exportQueueLabels}
        />
      </div>

      <ConfirmationPopup
        open={isDeletePending}
        header={t(ConversationPanelI18nKeys.DeleteConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isDeleting}
        description={
          <>
            <span className="break-words">
              {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
              <span className="dial-small-text text-primary">
                &ldquo;{pendingDeleteTitle}&rdquo;
              </span>
              ?
            </span>
            {deleteError && (
              <span className="mt-1 block text-error">{deleteError}</span>
            )}
          </>
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCloseDeleteDialog}
        onClose={handleCloseDeleteDialog}
      />

      <ConfirmationPopup
        open={isUnpublishPending}
        header={t(ConversationUnpublishI18nKeys.ConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.Unpublish)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isUnpublishing}
        disableConfirmButton={
          hasUnpublishFolderChoice && selectedUnpublishFolder == null
        }
        description={
          <>
            <span className="break-words">
              {hasUnpublishFolderChoice
                ? t(ConversationUnpublishI18nKeys.SelectFolderMessage, {
                    name: pendingUnpublish?.title ?? '',
                  })
                : t(ConversationUnpublishI18nKeys.ConfirmMessage, {
                    name: pendingUnpublish?.title ?? '',
                    folder: unpublishFolders[0] ?? '',
                  })}
            </span>
            {hasUnpublishFolderChoice && (
              <RadioGroup
                className="mt-3"
                ariaLabel={t(
                  ConversationUnpublishI18nKeys.FolderGroupAriaLabel,
                )}
                value={selectedUnpublishFolder ?? undefined}
                onChange={setSelectedUnpublishFolder}
                disabled={isUnpublishing}
                items={unpublishFolders.map((folder) => ({
                  value: folder,
                  label: folder,
                }))}
                radioClassName="dial-small-text text-primary"
              />
            )}
          </>
        }
        onConfirm={handleConfirmUnpublish}
        onCancel={handleCloseUnpublishDialog}
        onClose={handleCloseUnpublishDialog}
      />

      {/* Outside the popup on purpose: `ConfirmationPopup` swaps its whole
       * body for a spinner while `isLoading`, so a region rendered in
       * `description` would unmount at the moment it needs to announce.
       * Mounted only while the popup is open, so the panel does not carry a
       * second permanent status region alongside the transfer queues. */}
      {pendingUnpublish != null && (
        <span role="status" aria-live="polite" className="sr-only">
          {isUnpublishing
            ? t(ConversationUnpublishI18nKeys.RequestingStatus)
            : ''}
        </span>
      )}

      <ConfirmationPopup
        open={isUnsharePending}
        header={t(ConversationPanelI18nKeys.UnshareConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.RemoveFromMyList)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isUnsharing}
        description={
          <>
            <span className="break-words">
              {t(ConversationPanelI18nKeys.UnshareConfirmMessage, {
                name: pendingUnshareTitle,
              })}
            </span>
            {unshareError && (
              <span role="alert" className="mt-1 block text-error">
                {unshareError}
              </span>
            )}
          </>
        }
        onConfirm={handleConfirmUnshare}
        onCancel={handleCloseUnshareDialog}
        onClose={handleCloseUnshareDialog}
      />

      <ConfirmationPopup
        open={isRevokePending}
        header={t(ConversationPanelI18nKeys.RevokeConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.RevokeAccess)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isRevoking}
        description={
          <>
            <span className="break-words">
              {t(ConversationPanelI18nKeys.RevokeConfirmMessage, {
                name: pendingRevokeTitle,
              })}
            </span>
            {revokeError && (
              <span role="alert" className="mt-1 block text-error">
                {revokeError}
              </span>
            )}
          </>
        }
        onConfirm={handleConfirmRevoke}
        onCancel={handleCloseRevokeDialog}
        onClose={handleCloseRevokeDialog}
      />

      <RenameConversationPopup
        isOpen={isRenamePending}
        currentTitle={pendingRename?.title ?? ''}
        isSaving={isRenaming}
        error={renameError}
        onSave={handleConfirmRename}
        onCancel={handleCloseRenameDialog}
        onGenerateWithAi={handleGenerateRenameWithAi}
        labels={renameLabels}
      />

      {isConversationsSharingEnabled && (
        <Popup
          open={pendingShareConversationPath !== null}
          onClose={handleCloseSharePopover}
          hideClose
          headerClassName="hidden"
          size={PopupSize.Sm}
        >
          <ShareConversationPopoverContainer
            conversationPath={pendingShareConversationPath ?? ''}
            onClose={handleCloseSharePopover}
          />
        </Popup>
      )}

      {isConversationsPublishingEnabled &&
        pendingPublishConversation !== null && (
          <PublishConversationPanelContainer
            isOpen
            conversationPath={pendingPublishConversation.path}
            conversationTitle={pendingPublishConversation.title}
            onClose={handleClosePublishPanel}
            returnFocusRef={publishReturnFocusRef}
            history={publishPanelHistory.entries}
            isHistoryLoading={
              publishPanelHistory.status === PublishHistoryStatus.Loading
            }
            hasHistoryError={
              publishPanelHistory.status === PublishHistoryStatus.Failed
            }
          />
        )}
    </>
  );
};

export default memo(ConversationPanelView);
