import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ConversationPanel,
  FilterTab,
  type ConversationItem,
  type ConversationMove,
  type ConversationPanelStyles,
} from '@epam/ai-dial-conversation-panel';
import {
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialPopup,
  NotificationVariant,
  PopupSize,
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
  IconWorldShare,
} from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
} from 'react';
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
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useConversationExport } from '../../hooks/useConversationExport';
import { useConversationImport } from '../../hooks/useConversationImport';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getApiErrorDetails } from '../../server-api/api-error';
import { discardSharedCatalogItem } from '../../server-api/share.api';
import { ConversationExportMode } from '../../types/conversation-export';
import { ROUTES } from '../../types/routes';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../../utils/conversation-id-match';
import { getConversationPath } from '../../utils/conversation-path';
import { getModelIdFromConversationId } from '../../utils/get-model-id-from-conversation-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import ImportExportQueue from '../ImportExportQueue/ImportExportQueue';
import PublishConversationPanelContainer from '../PublishConversationPanelContainer/PublishConversationPanelContainer';
import RenameConversationPopup from '../RenameConversationPopup/RenameConversationPopup';
import ShareConversationPopoverContainer from '../ShareConversationPopoverContainer/ShareConversationPopoverContainer';
import ConversationPanelMenu from './ConversationPanelMenu';
import { getConversationSource } from './get-conversation-source';

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
  const { showNotification } = useNotification();
  const isConversationsSectionEnabled = useUiFeature(
    OverlayFeature.ConversationsSection,
  );
  const isConversationsSharingEnabled = useUiFeature(
    OverlayFeature.ConversationsSharing,
  );
  const isConversationsPublishingEnabled = useUiFeature(
    OverlayFeature.ConversationsPublishing,
  );
  const {
    jobs: exportJobs,
    exportSingle,
    exportAll,
    dismissJob: dismissExportJob,
    retryJob: retryExportJob,
    dismissAll: dismissAllExports,
  } = useConversationExport();
  const {
    jobs: importJobs,
    importConversations,
    dismissJob: dismissImportJob,
    retryJob: retryImportJob,
    dismissAll: dismissAllImports,
  } = useConversationImport();
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

  const { items: deployments, isLoading: isDeploymentsLoading } =
    useDeployments();
  const deploymentIconByModelId = useMemo(
    () => new Map(deployments.map((d) => [d.id, d.iconUrl])),
    [deployments],
  );
  const deploymentNameByModelId = useMemo(
    () =>
      new Map(
        deployments.map((d) => [
          d.id,
          resolveLocalizedText(d.displayName, language) || d.id,
        ]),
      ),
    [deployments, language],
  );

  const panelActiveConversationId = useMemo(
    () =>
      activeConversationId
        ? toPanelConversationId(activeConversationId)
        : undefined,
    [activeConversationId],
  );

  useEffect(() => {
    if (!panelActiveConversationId) return;
    const isListed = items.some((item) =>
      conversationIdsMatch(item.id, panelActiveConversationId),
    );
    if (!isListed) void refreshConversations();
    // Intentionally not including items or refreshConversations in the dependency array to avoid re-triggering on every list update.
  }, [panelActiveConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Single shared entry point for marking a scheduler-created conversation as
   * viewed — fires whenever the active conversation changes, whether the user
   * navigated by clicking a history panel row or via direct URL navigation.
   * markConversationViewed itself no-ops for non-scheduler or already-read items.
   */
  useEffect(() => {
    if (!panelActiveConversationId) return;
    const activeItem = items.find((item) =>
      conversationIdsMatch(item.id, panelActiveConversationId),
    );
    if (activeItem) void markConversationViewed(activeItem.id);
  }, [panelActiveConversationId, items, markConversationViewed]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingUnshareId, setPendingUnshareId] = useState<string | null>(null);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [unshareError, setUnshareError] = useState<string | null>(null);

  const [pendingRenameItem, setPendingRenameItem] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [pendingShareConversationPath, setPendingShareConversationPath] =
    useState<string | null>(null);

  const [pendingPublishConversation, setPendingPublishConversation] = useState<{
    path: string;
    title: string;
  } | null>(null);
  const publishReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  const handleActionMenuOpen = useCallback(
    (_item: ConversationItem, trigger: HTMLButtonElement) => {
      publishReturnFocusRef.current = trigger;
    },
    [],
  );

  const handleExportAll = useCallback(() => {
    void exportAll();
  }, [exportAll]);

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset so selecting the same file again re-triggers onChange.
      event.target.value = '';
      if (file) void importConversations(file);
    },
    [importConversations],
  );

  const exportQueueTitle = t(ConversationExportI18nKeys.QueueTitle);
  const importQueueTitle = t(ConversationImportI18nKeys.QueueTitle);

  /** Map panel id → context id for reverse lookup */
  const panelToContextId = useMemo(
    () =>
      new Map(items.map((item) => [toPanelConversationId(item.id), item.id])),
    [items],
  );

  const taskBadgeLabel = t(ConversationPanelI18nKeys.TaskBadgeLabel);
  const unreadIndicatorLabel = t(
    ConversationPanelI18nKeys.UnreadIndicatorLabel,
  );

  const conversations: ConversationItem[] = useMemo(
    () =>
      items.map((item) => {
        const id = toPanelConversationId(item.id);
        const modelId = getModelIdFromConversationId(item.id);
        const iconUrl = modelId
          ? deploymentIconByModelId.get(modelId)
          : undefined;

        return {
          id,
          title: item.title,
          isPinned: item.isPinned ?? false,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          iconTooltip: modelId
            ? deploymentNameByModelId.get(modelId)
            : undefined,
          isIconLoading: isDeploymentsLoading,
          source: getConversationSource(item),
          href: getConversationRoute(id),
          ...(item.isScheduledTask
            ? { showTaskBadge: true, taskBadgeLabel, isUnread: item.isUnread }
            : {}),
        };
      }),
    [
      items,
      deploymentIconByModelId,
      deploymentNameByModelId,
      isDeploymentsLoading,
      taskBadgeLabel,
    ],
  );

  const filterLabels = useMemo(
    () => ({
      all: t(ConversationPanelI18nKeys.FilterAll),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(BasicI18nKeys.Organization),
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
      const contextId = panelToContextId.get(draggedId);
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
    [panelToContextId, conversations, pinConversation],
  );

  const getActions = useCallback(
    (panelItem: ConversationItem): DropdownItem[] => {
      const contextId = panelToContextId.get(panelItem.id);
      if (!contextId) return [];

      const rawItem = items.find((c) => c.id === contextId);
      const isReadonlyItem =
        rawItem?.isReadonly ||
        rawItem?.sharedWithMe ||
        rawItem?.publishedWithMe;

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
          <IconPin size={DIAL_ICON_SIZE.SM} className="text-secondary" />
        ),
        onClick: () => pinConversation(contextId, !panelItem.isPinned),
      };

      const duplicateAction: DropdownItem = {
        key: 'duplicate',
        label: t(ButtonsI18nKeys.Duplicate),
        icon: <IconCopy size={DIAL_ICON_SIZE.SM} className="text-secondary" />,
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
            navigate(getConversationRoute(newPath));
          } catch (error) {
            const { traceId } = await getApiErrorDetails(error);
            showNotification({
              variant: NotificationVariant.Error,
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
          <IconDownload size={DIAL_ICON_SIZE.SM} className="text-secondary" />
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
            label: t(ButtonsI18nKeys.Delete),
            icon: (
              <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />
            ),
            onClick: () => setPendingUnshareId(contextId),
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
            />
          ),
          onClick: () =>
            setPendingRenameItem({ id: contextId, title: panelItem.title }),
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
                  />
                ),
                onClick: () => setPendingShareConversationPath(contextId),
              },
            ]
          : []),
        ...(isConversationsPublishingEnabled
          ? [
              {
                key: 'publish',
                label: t(ButtonsI18nKeys.Publish),
                icon: (
                  <IconWorldShare
                    size={DIAL_ICON_SIZE.SM}
                    className="text-secondary"
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
        {
          key: 'delete',
          label: t(ButtonsI18nKeys.Delete),
          icon: (
            <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />
          ),
          onClick: () => setPendingDeleteId(contextId),
        },
      ];
    },
    [
      panelToContextId,
      items,
      t,
      pinConversation,
      duplicateConversation,
      panelActiveConversationId,
      isConversationsSharingEnabled,
      isConversationsPublishingEnabled,
      navigate,
      onDuplicateReadonly,
      showNotification,
      exportSingle,
    ],
  );

  const handleCloseSharePopover = useCallback(() => {
    setPendingShareConversationPath(null);
  }, []);

  const handleClosePublishPanel = useCallback(() => {
    setPendingPublishConversation(null);
  }, []);

  const pendingDeleteTitle = useMemo(() => {
    if (!pendingDeleteId) return '';
    return items.find((c) => c.id === pendingDeleteId)?.title ?? '';
  }, [items, pendingDeleteId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const idToDelete = pendingDeleteId;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteConversation(idToDelete);
      showNotification({
        variant: NotificationVariant.Success,
        message: t(ConversationPanelI18nKeys.DeleteSuccess),
        title: t(ConversationPanelI18nKeys.DeleteSuccessTitle),
      });
    } catch {
      setDeleteError(t(ConversationPanelI18nKeys.DeleteError));
      setIsDeleting(false);
      return;
    }
    setIsDeleting(false);
    setPendingDeleteId(null);

    const isActiveDeletion =
      panelActiveConversationId != null &&
      conversationIdsMatch(idToDelete, panelActiveConversationId);
    if (isActiveDeletion) {
      navigate(ROUTES.Root);
    }
  }, [
    pendingDeleteId,
    showNotification,
    deleteConversation,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (isDeleting) return;
    setPendingDeleteId(null);
    setDeleteError(null);
  }, [isDeleting]);

  const pendingUnshareTitle = useMemo(() => {
    if (!pendingUnshareId) return '';
    return items.find((c) => c.id === pendingUnshareId)?.title ?? '';
  }, [items, pendingUnshareId]);

  const handleConfirmUnshare = useCallback(async () => {
    if (!pendingUnshareId) return;
    const idToUnshare = pendingUnshareId;

    setIsUnsharing(true);
    setUnshareError(null);
    try {
      await discardSharedCatalogItem(idToUnshare);
    } catch {
      setUnshareError(
        t(ConversationPanelI18nKeys.UnshareError, {
          name: pendingUnshareTitle,
        }),
      );
      setIsUnsharing(false);
      return;
    }

    try {
      await refreshConversations();
    } catch {
      /* The discard already succeeded; a refresh failure must not undo that success. */
    }

    showNotification({
      variant: NotificationVariant.Success,
      title: t(ConversationPanelI18nKeys.UnshareSuccessTitle),
      message: t(ConversationPanelI18nKeys.UnshareSuccess, {
        name: pendingUnshareTitle,
      }),
    });

    setIsUnsharing(false);
    setPendingUnshareId(null);

    const isActiveUnshare =
      panelActiveConversationId != null &&
      conversationIdsMatch(idToUnshare, panelActiveConversationId);
    if (isActiveUnshare) {
      navigate(ROUTES.Root);
    }
  }, [
    pendingUnshareId,
    pendingUnshareTitle,
    refreshConversations,
    showNotification,
    panelActiveConversationId,
    navigate,
    t,
  ]);

  const handleCloseUnshareDialog = useCallback(() => {
    if (isUnsharing) return;
    setPendingUnshareId(null);
    setUnshareError(null);
  }, [isUnsharing]);

  const handleConfirmRename = useCallback(
    async (newTitle: string) => {
      if (!pendingRenameItem) return;
      const { id } = pendingRenameItem;

      setIsRenaming(true);
      setRenameError(null);
      try {
        await renameConversation(id, newTitle);
      } catch {
        setRenameError(t(ConversationPanelI18nKeys.RenameError));
        setIsRenaming(false);
        return;
      }
      setIsRenaming(false);
      setPendingRenameItem(null);
    },
    [pendingRenameItem, renameConversation, t],
  );

  const handleGenerateRenameWithAi = useCallback(async () => {
    if (!pendingRenameItem) return '';
    return generateConversationTitle(pendingRenameItem.id);
  }, [pendingRenameItem, generateConversationTitle]);

  const handleCloseRenameDialog = useCallback(() => {
    if (isRenaming) return;
    setPendingRenameItem(null);
    setRenameError(null);
  }, [isRenaming]);

  const handleActiveFilterChange = useCallback(
    (tab: FilterTab) => {
      onRequestedFilterChange?.();
      onActiveFilterChange?.(tab);
    },
    [onRequestedFilterChange, onActiveFilterChange],
  );

  let panelClassName: string | undefined;
  if (isMobile) {
    panelClassName = mergeClasses('inset-y-0 start-0', isOpen && 'z-50');
  } else if (isOpen) {
    panelClassName = mergeClasses(
      '[--sb-border-inline-end:transparent]',
      '[--sb-bg-resize-handler:transparent]',
    );
  }
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
        accept={isMobile ? undefined : IMPORT_FILE_ACCEPT}
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
          onDismiss={dismissImportJob}
          onRetry={retryImportJob}
        />
        <ImportExportQueue
          title={exportQueueTitle}
          jobs={exportJobs}
          onClose={dismissAllExports}
          onDismiss={dismissExportJob}
          onRetry={retryExportJob}
        />
      </div>

      <DialConfirmationPopup
        open={!!pendingDeleteId}
        header={t(ConversationPanelI18nKeys.DeleteConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isDeleting}
        description={
          <>
            <span className="break-all">
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

      <DialConfirmationPopup
        open={!!pendingUnshareId}
        header={t(ConversationPanelI18nKeys.UnshareConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isUnsharing}
        description={
          <>
            <span className="break-all">
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

      <RenameConversationPopup
        isOpen={pendingRenameItem !== null}
        currentTitle={pendingRenameItem?.title ?? ''}
        isSaving={isRenaming}
        error={renameError}
        onSave={handleConfirmRename}
        onCancel={handleCloseRenameDialog}
        onGenerateWithAi={handleGenerateRenameWithAi}
      />

      {isConversationsSharingEnabled && (
        <DialPopup
          open={pendingShareConversationPath !== null}
          onClose={handleCloseSharePopover}
          dividers={false}
          hideClose
          headerClassName="hidden"
          size={PopupSize.Sm}
        >
          <ShareConversationPopoverContainer
            conversationPath={pendingShareConversationPath ?? ''}
            onClose={handleCloseSharePopover}
          />
        </DialPopup>
      )}

      {isConversationsPublishingEnabled &&
        pendingPublishConversation !== null && (
          <PublishConversationPanelContainer
            isOpen
            conversationPath={pendingPublishConversation.path}
            conversationTitle={pendingPublishConversation.title}
            onClose={handleClosePublishPanel}
            returnFocusRef={publishReturnFocusRef}
          />
        )}
    </>
  );
};

export default memo(ConversationPanelView);
