import {
  ConversationPanel,
  type ConversationHistoryItem,
} from '@epam/ai-dial-conversation-panel';
import {
  ButtonAppearance,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialDropdown,
  DialIconButton,
  DialNotification,
  ElementSize,
  NotificationVariant,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import type { ConversationDeletionResultDto } from '@epam/chat-api-client';
import {
  IconCopy,
  IconDotsVertical,
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
import { StorageKey } from '../../constants/storage';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import useViewportWidth from '../../hooks/use-viewport-width';
import useLocalStorage from '../../hooks/useLocalStorage';
import { getModelIdFromConversationId } from '../../utils/get-model-id-from-conversation-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import RenameConversationPopup from '../RenameConversationPopup/RenameConversationPopup';
import { getConversationSource } from './get-conversation-source';

const PanelMenuTrigger: FC<{ items: DropdownItem[]; label: string }> = ({
  items,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DialDropdown items={items} placement="bottom-end" onOpenChange={setIsOpen}>
      <DialIconButton
        aria-label={label}
        appearance={ButtonAppearance.Ghost}
        size={ElementSize.Small}
        icon={
          <IconDotsVertical
            size={DIAL_ICON_SIZE.SM}
            className={
              isOpen
                ? '[color:var(--text-accent-secondary)]'
                : '[color:var(--text-secondary)]'
            }
          />
        }
        className={[
          'flex items-center justify-center rounded',
          isOpen
            ? '[background:var(--controls-bg-accent-secondary-alpha-active)]'
            : '',
        ].join(' ')}
      />
    </DialDropdown>
  );
};

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
  const {
    conversations: items,
    isLoading,
    pinConversation,
    deleteConversation,
    renameConversation,
    duplicateConversation,
    refreshConversations,
    deleteAllConversations,
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

  const [isDeleteAllPopupOpen, setIsDeleteAllPopupOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const [deleteAllPartialError, setDeleteAllPartialError] = useState<
    string | null
  >(null);

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
      all: t(ConversationPanelI18nKeys.FilterAll),
      myChats: t(ConversationPanelI18nKeys.FilterMyChats),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(ConversationPanelI18nKeys.FilterOrganization),
    }),
    [t],
  );

  const groupLabels = useMemo(
    () => ({
      pinned: t(ConversationPanelI18nKeys.PinnedSection),
      myChats: t(ConversationPanelI18nKeys.MyChatsSection),
      shared: t(ConversationPanelI18nKeys.FilterShared),
      organization: t(ConversationPanelI18nKeys.FilterOrganization),
    }),
    [t],
  );

  const panelMenuItems: DropdownItem[] = useMemo(
    () => [
      {
        key: 'delete-all',
        label: t(ConversationPanelI18nKeys.DeleteAllChatsLabel),
        icon: (
          <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />
        ),
        onClick: () => {
          setDeleteAllError(null);
          setDeleteAllPartialError(null);
          setIsDeleteAllPopupOpen(true);
        },
      },
    ],
    [t],
  );

  const headerActions = useMemo(
    () => (
      <PanelMenuTrigger
        items={panelMenuItems}
        label={t(ConversationPanelI18nKeys.PanelActionsLabel)}
      />
    ),
    [panelMenuItems, t],
  );

  const getActions = useCallback(
    (panelItem: ConversationHistoryItem): DropdownItem[] => {
      const contextId = panelToContextId.get(panelItem.id);
      if (!contextId) return [];

      return [
        {
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
              setDuplicateError(t(ConversationPanelI18nKeys.DuplicateError));
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
      setDeleteError(t(ConversationPanelI18nKeys.DeleteError));
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
        setRenameError(t(ConversationPanelI18nKeys.RenameError));
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

  const handleConfirmDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    setDeleteAllError(null);

    let result: ConversationDeletionResultDto;
    try {
      result = await deleteAllConversations();
    } catch {
      setDeleteAllError(t(ConversationPanelI18nKeys.DeleteAllError));
      setIsDeletingAll(false);
      return;
    }

    setIsDeletingAll(false);

    const isTotalFailure =
      result.failed.length > 0 &&
      result.deleted === 0 &&
      result.alreadyAbsent === 0;
    const isPartialFailure =
      result.failed.length > 0 &&
      (result.deleted > 0 || result.alreadyAbsent > 0);

    if (isTotalFailure) {
      setDeleteAllError(t(ConversationPanelI18nKeys.DeleteAllError));
      return;
    }

    setIsDeleteAllPopupOpen(false);

    if (isPartialFailure) {
      setDeleteAllPartialError(
        t(ConversationPanelI18nKeys.DeleteAllPartialError),
      );
    }

    if (activeConversationId) {
      const activeItem = items.find((item) => {
        const rawId = normalizeConversationId(item.id);
        try {
          return decodeURIComponent(rawId) === activeConversationId;
        } catch {
          return rawId === activeConversationId;
        }
      });
      const isActiveOwned =
        activeItem != null &&
        !activeItem.sharedWithMe &&
        !activeItem.publishedWithMe;
      if (isActiveOwned) {
        navigate(ROUTES.ROOT);
      }
    }
  }, [deleteAllConversations, activeConversationId, items, navigate, t]);

  const handleCancelDeleteAll = useCallback(() => {
    if (isDeletingAll) return;
    setIsDeleteAllPopupOpen(false);
    setDeleteAllError(null);
  }, [isDeletingAll]);

  return (
    <>
      <ConversationPanel
        conversations={conversations}
        isLoading={isLoading}
        isOpen={isOpen}
        onSelectConversation={onSelectConversation}
        activeConversationId={activeConversationId}
        title={t(ConversationPanelI18nKeys.Title)}
        emptyLabel={t(ConversationPanelI18nKeys.Empty)}
        noResultsLabel={t(BasicI18nKeys.NoResults)}
        onNewChat={onNewChat}
        newChatLabel={t(ConversationPanelI18nKeys.NewChat)}
        searchPlaceholder={t(BasicI18nKeys.SearchPlaceholder)}
        filterLabels={filterLabels}
        groupLabels={groupLabels}
        getActions={getActions}
        actionsLabel={t(ConversationPanelI18nKeys.ActionsLabel)}
        onToggle={isMobile ? onClose : undefined}
        closeAriaLabel={t(ConversationPanelI18nKeys.ToggleAriaLabel)}
        className={isMobile ? 'inset-y-0 start-0 z-50' : undefined}
        styles={{ typography: { fontClassName: 'dial-body-text' } }}
        resizable={!isMobile}
        defaultPanelWidth={defaultPanelWidth}
        maxPanelWidth={maxPanelWidth}
        onPanelResizeStop={setStoredPanelWidth}
        headerActions={headerActions}
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
              {t(ConversationPanelI18nKeys.DeleteConfirmDescription)}{' '}
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

      <DialConfirmationPopup
        open={isDeleteAllPopupOpen}
        header={t(ConversationPanelI18nKeys.DeleteAllConfirmTitle)}
        confirmLabel={t(ConversationPanelI18nKeys.DeleteAllConfirmButton)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isDeletingAll}
        disableConfirmButton={isDeletingAll}
        description={
          <>
            <span>
              {t(ConversationPanelI18nKeys.DeleteAllConfirmDescription)}
            </span>
            {deleteAllError && (
              <span className="mt-1 block text-error">{deleteAllError}</span>
            )}
          </>
        }
        onConfirm={handleConfirmDeleteAll}
        onCancel={handleCancelDeleteAll}
        onClose={handleCancelDeleteAll}
      />

      {deleteAllPartialError && (
        <DialNotification
          variant={NotificationVariant.Error}
          message={deleteAllPartialError}
          closable
          onClose={() => setDeleteAllPartialError(null)}
          className="fixed bottom-4 start-4 z-50 max-w-sm"
        />
      )}
    </>
  );
};

export default memo(ConversationPanelView);
