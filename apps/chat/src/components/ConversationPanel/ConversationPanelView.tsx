import {
  ConversationPanel,
  type ConversationHistoryItem,
} from '@epam/ai-dial-conversation-panel';
import {
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialNotification,
  NotificationVariant,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconCopy,
  IconPencilMinus,
  IconPin,
  IconPinnedFilled,
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
import {
  getConversationRoute,
  normalizeConversationId,
  ROUTES,
} from '../../constants/routes';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationHistoryI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { getModelIdFromConversationId } from '../../utils/get-model-id-from-conversation-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import RenameConversationPopup from '../RenameConversationPopup/RenameConversationPopup';
import { getConversationSource } from './get-conversation-source';

interface Props {
  isOpen: boolean;
  activeConversationId?: string;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

const ConversationPanelView: FC<Props> = ({
  isOpen,
  activeConversationId,
  onClose,
  onSelectConversation,
  onNewChat,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const {
    conversations: items,
    pinConversation,
    deleteConversation,
    renameConversation,
    duplicateConversation,
    refreshConversations,
  } = useConversations();

  const { items: deployments } = useDeployments();
  const deploymentIconByModelId = useMemo(
    () => new Map(deployments.map((d) => [d.id, d.iconUrl])),
    [deployments],
  );
  const deploymentNameByModelId = useMemo(
    () => new Map(deployments.map((d) => [d.id, d.displayName ?? d.id])),
    [deployments],
  );

  useEffect(() => {
    if (!activeConversationId) return;
    const isListed = items.some((item) => {
      const rawId = normalizeConversationId(item.id);
      try {
        return decodeURIComponent(rawId) === activeConversationId;
      } catch {
        return rawId === activeConversationId;
      }
    });
    if (!isListed) void refreshConversations();
    // Intentionally not including items or refreshConversations in the dependency array to avoid re-triggering on every list update.
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pendingRenameItem, setPendingRenameItem] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  /** Map panel id → context id for reverse lookup */
  const panelToContextId = useMemo(
    () =>
      new Map(
        items.map((item) => {
          const rawId = normalizeConversationId(item.id);
          let panelId: string;
          try {
            panelId = decodeURIComponent(rawId);
          } catch {
            panelId = rawId;
          }
          return [panelId, item.id];
        }),
      ),
    [items],
  );

  const conversations: ConversationHistoryItem[] = useMemo(
    () =>
      items.map((item) => {
        const rawId = normalizeConversationId(item.id);
        let id: string;
        try {
          id = decodeURIComponent(rawId);
        } catch (e) {
          console.error('Failed to decode conversation id:', rawId, e);
          id = rawId;
        }
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
          source: getConversationSource(item),
          href: getConversationRoute(id),
        };
      }),
    [items, deploymentIconByModelId, deploymentNameByModelId],
  );

  const filterLabels = useMemo(
    () => ({
      all: t(ConversationHistoryI18nKeys.FilterAll),
      myChats: t(ConversationHistoryI18nKeys.FilterMyChats),
      shared: t(ConversationHistoryI18nKeys.FilterShared),
      organization: t(ConversationHistoryI18nKeys.FilterOrganization),
    }),
    [t],
  );

  const groupLabels = useMemo(
    () => ({
      pinned: t(ConversationHistoryI18nKeys.PinnedSection),
      myChats: t(ConversationHistoryI18nKeys.MyChatsSection),
      shared: t(ConversationHistoryI18nKeys.FilterShared),
      organization: t(ConversationHistoryI18nKeys.FilterOrganization),
    }),
    [t],
  );

  const getActions = useCallback(
    (panelItem: ConversationHistoryItem): DropdownItem[] => {
      const contextId = panelToContextId.get(panelItem.id);
      if (!contextId) return [];

      return [
        {
          key: 'pin',
          label: panelItem.isPinned
            ? t(ConversationHistoryI18nKeys.UnpinLabel)
            : t(ConversationHistoryI18nKeys.PinLabel),
          icon: panelItem.isPinned ? (
            <IconPinnedFilled
              size={DIAL_ICON_SIZE.SM}
              className="text-secondary"
            />
          ) : (
            <IconPin size={DIAL_ICON_SIZE.SM} className="text-secondary" />
          ),
          onClick: () => pinConversation(contextId, !panelItem.isPinned),
        },
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
        {
          key: 'duplicate',
          label: t(ButtonsI18nKeys.Duplicate),
          icon: (
            <IconCopy size={DIAL_ICON_SIZE.SM} className="text-secondary" />
          ),
          onClick: async () => {
            setDuplicateError(null);
            try {
              const newPath = await duplicateConversation(contextId);
              navigate(getConversationRoute(newPath));
            } catch {
              setDuplicateError(t(ConversationHistoryI18nKeys.DuplicateError));
            }
          },
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
      pinConversation,
      duplicateConversation,
      navigate,
      t,
      setDuplicateError,
    ],
  );

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
    } catch {
      setDeleteError(t(ConversationHistoryI18nKeys.DeleteError));
      setIsDeleting(false);
      return;
    }
    setIsDeleting(false);
    setPendingDeleteId(null);

    const activeContextId = activeConversationId
      ? panelToContextId.get(activeConversationId)
      : undefined;
    if (activeContextId === idToDelete) navigate(ROUTES.ROOT);
  }, [
    pendingDeleteId,
    deleteConversation,
    activeConversationId,
    panelToContextId,
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
      let newPath: string;
      try {
        newPath = await renameConversation(id, newTitle);
      } catch {
        setRenameError(t(ConversationHistoryI18nKeys.RenameError));
        setIsRenaming(false);
        return;
      }
      setIsRenaming(false);
      setPendingRenameItem(null);

      const activeContextId = activeConversationId
        ? panelToContextId.get(activeConversationId)
        : undefined;
      if (activeContextId === id) navigate(getConversationRoute(newPath));
    },
    [
      pendingRenameItem,
      renameConversation,
      activeConversationId,
      panelToContextId,
      navigate,
      t,
    ],
  );

  const handleCloseRenameDialog = useCallback(() => {
    if (isRenaming) return;
    setPendingRenameItem(null);
    setRenameError(null);
  }, [isRenaming]);

  return (
    <>
      <ConversationPanel
        conversations={conversations}
        isOpen={isOpen}
        onSelectConversation={onSelectConversation}
        activeConversationId={activeConversationId}
        title={t(ConversationHistoryI18nKeys.Title)}
        emptyLabel={t(ConversationHistoryI18nKeys.Empty)}
        noResultsLabel={t(BasicI18nKeys.NoResults)}
        onNewChat={onNewChat}
        newChatLabel={t(ConversationHistoryI18nKeys.NewChat)}
        searchPlaceholder={t(BasicI18nKeys.SearchPlaceholder)}
        filterLabels={filterLabels}
        groupLabels={groupLabels}
        getActions={getActions}
        actionsLabel={t(ConversationHistoryI18nKeys.ActionsLabel)}
        onToggle={isMobile ? onClose : undefined}
        closeAriaLabel={t(ConversationHistoryI18nKeys.ToggleAriaLabel)}
        className={isMobile ? 'inset-y-0 start-0 z-50' : undefined}
        styles={{ typography: { fontClassName: 'dial-body-text' } }}
      />

      <DialConfirmationPopup
        open={!!pendingDeleteId}
        header={t(ConversationHistoryI18nKeys.DeleteConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isDeleting}
        description={
          <>
            <span className="break-all">
              {t(ConversationHistoryI18nKeys.DeleteConfirmDescription)}{' '}
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
      />

      {duplicateError && (
        <DialNotification
          variant={NotificationVariant.Error}
          message={duplicateError}
          closable
          onClose={() => setDuplicateError(null)}
          className="fixed bottom-4 start-4 z-50 max-w-sm"
        />
      )}
    </>
  );
};

export default memo(ConversationPanelView);
