import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ConversationGroupKey,
  ConversationPanel,
  FilterTab,
  type ConversationHistoryItem,
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
  IconPencilMinus,
  IconPin,
  IconPinnedFilled,
  IconShare,
  IconTrashX,
} from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getConversationRoute } from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
  ShareI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import useViewportWidth from '../../hooks/use-viewport-width';
import useLocalStorage from '../../hooks/useLocalStorage';
import { ROUTES } from '../../types/routes';
import { StorageKey } from '../../types/storage-key';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../../utils/conversation-id-match';
import { getModelIdFromConversationId } from '../../utils/get-model-id-from-conversation-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import RenameConversationPopup from '../RenameConversationPopup/RenameConversationPopup';
import ShareConversationPopoverContainer from '../ShareConversationPopoverContainer/ShareConversationPopoverContainer';
import DeleteAllConversationsAction from './DeleteAllConversationsAction';
import { getConversationSource } from './get-conversation-source';

const PANEL_STYLES: ConversationPanelStyles = {
  typography: {
    itemIconBadgeClassName: 'rounded-lg',
  },
};

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
  const isMobile = useIsMobile();
  const viewportWidth = useViewportWidth();
  const maxPanelWidth = Math.floor(viewportWidth * 0.5);
  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    StorageKey.ConversationPanelWidth,
    325,
  );
  const defaultPanelWidth = Math.min(
    Math.max(storedPanelWidth, 312),
    maxPanelWidth,
  );
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const {
    conversations: items,
    isLoading,
    pinConversation,
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
    () => new Map(deployments.map((d) => [d.id, d.displayName ?? d.id])),
    [deployments],
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

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingRenameItem, setPendingRenameItem] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [pendingShareConversationPath, setPendingShareConversationPath] =
    useState<string | null>(null);

  /** Map panel id → context id for reverse lookup */
  const panelToContextId = useMemo(
    () =>
      new Map(items.map((item) => [toPanelConversationId(item.id), item.id])),
    [items],
  );

  const conversations: ConversationHistoryItem[] = useMemo(
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
        };
      }),
    [
      items,
      deploymentIconByModelId,
      deploymentNameByModelId,
      isDeploymentsLoading,
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

      if (targetGroupKey === ConversationGroupKey.Pinned) {
        void pinConversation(contextId, true);
      } else if (draggedItem.isPinned) {
        void pinConversation(contextId, false);
      }
      // Same-group reorder: no API available in this iteration — no-op.
    },
    [panelToContextId, conversations, pinConversation],
  );

  const getActions = useCallback(
    (panelItem: ConversationHistoryItem): DropdownItem[] => {
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
          } catch {
            showNotification({
              variant: NotificationVariant.Error,
              message: t(ConversationPanelI18nKeys.DuplicateError),
            });
          }
        },
      };

      if (isReadonlyItem) {
        return [pinAction, duplicateAction];
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
        {
          key: 'share',
          label: t(ShareI18nKeys.Title),
          icon: (
            <IconShare size={DIAL_ICON_SIZE.SM} className="text-secondary" />
          ),
          onClick: () => setPendingShareConversationPath(contextId),
        },
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
      navigate,
      onDuplicateReadonly,
      showNotification,
    ],
  );

  const handleCloseSharePopover = useCallback(() => {
    setPendingShareConversationPath(null);
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
      <ConversationPanel
        conversations={conversations}
        isLoading={isLoading}
        isOpen={isOpen}
        onSelectConversation={onSelectConversation}
        activeConversationId={panelActiveConversationId}
        activeFilter={requestedFilter}
        onActiveFilterChange={handleActiveFilterChange}
        title={t(ConversationPanelI18nKeys.Title)}
        emptyLabel={t(ConversationPanelI18nKeys.Empty)}
        noResultsLabel={t(BasicI18nKeys.NoResults)}
        onNewChat={onNewChat}
        newChatLabel={t(ButtonsI18nKeys.NewChat)}
        searchPlaceholder={t(BasicI18nKeys.SearchPlaceholder)}
        searchClearLabel={t(BasicI18nKeys.ClearSearch)}
        filterLabels={filterLabels}
        groupLabels={groupLabels}
        getActions={getActions}
        actionsLabel={t(ConversationPanelI18nKeys.ActionsLabel)}
        onToggle={isMobile ? onClose : undefined}
        closeAriaLabel={t(ConversationPanelI18nKeys.ToggleAriaLabel)}
        className={panelClassName}
        styles={PANEL_STYLES}
        resizable={!isMobile}
        defaultPanelWidth={defaultPanelWidth}
        maxPanelWidth={maxPanelWidth}
        onPanelResizeStop={setStoredPanelWidth}
        onMoveConversation={handleMoveConversation}
        headerActions={
          <DeleteAllConversationsAction
            activeConversationId={activeConversationId}
          />
        }
      />

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

      <RenameConversationPopup
        isOpen={pendingRenameItem !== null}
        currentTitle={pendingRenameItem?.title ?? ''}
        isSaving={isRenaming}
        error={renameError}
        onSave={handleConfirmRename}
        onCancel={handleCloseRenameDialog}
        onGenerateWithAi={handleGenerateRenameWithAi}
      />

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
    </>
  );
};

export default memo(ConversationPanelView);
