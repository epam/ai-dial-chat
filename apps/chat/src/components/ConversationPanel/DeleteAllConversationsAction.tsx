import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DialConfirmationPopup,
  DialDropdown,
  DialIconButton,
  ElementSize,
  NotificationVariant,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconDotsVertical, IconTrashX } from '@tabler/icons-react';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { normalizeConversationId, ROUTES } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';

interface PanelMenuTriggerProps {
  items: DropdownItem[];
  label: string;
}

const PanelMenuTrigger: FC<PanelMenuTriggerProps> = ({ items, label }) => {
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
            className={isOpen ? 'text-accent-secondary' : 'text-secondary'}
          />
        }
        className={mergeClasses(
          'flex items-center justify-center rounded',
          isOpen && 'bg-controls-accent-secondary-alpha-active',
        )}
      />
    </DialDropdown>
  );
};

interface DeleteAllConversationsActionProps {
  activeConversationId?: string;
}

const DeleteAllConversationsAction: FC<DeleteAllConversationsActionProps> = ({
  activeConversationId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { conversations, deleteAllConversations } = useConversations();
  const { showNotification } = useNotification();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpen = useCallback(() => {
    setDeleteError(null);
    setIsPopupOpen(true);
  }, []);

  const menuItems: DropdownItem[] = useMemo(
    () => [
      {
        key: 'delete-all',
        label: t(ConversationPanelI18nKeys.DeleteAllChatsLabel),
        icon: (
          <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />
        ),
        onClick: handleOpen,
      },
    ],
    [handleOpen, t],
  );

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const deletionResult = await deleteAllConversations();
      const isTotalFailure =
        deletionResult.failed.length > 0 &&
        deletionResult.deleted === 0 &&
        deletionResult.alreadyAbsent === 0;

      if (isTotalFailure) {
        setDeleteError(t(ConversationPanelI18nKeys.DeleteAllError));
        return;
      }

      setIsPopupOpen(false);

      if (deletionResult.failed.length > 0) {
        showNotification({
          variant: NotificationVariant.Error,
          message: t(ConversationPanelI18nKeys.DeleteAllPartialError),
        });
      }

      if (!activeConversationId) return;

      const activeConversation = conversations.find((conversation) => {
        const rawId = normalizeConversationId(conversation.id);
        try {
          return decodeURIComponent(rawId) === activeConversationId;
        } catch {
          return rawId === activeConversationId;
        }
      });
      const isActiveConversationOwned =
        activeConversation != null &&
        !activeConversation.sharedWithMe &&
        !activeConversation.publishedWithMe;

      if (isActiveConversationOwned) {
        navigate(ROUTES.ROOT);
      }
    } catch {
      setDeleteError(t(ConversationPanelI18nKeys.DeleteAllError));
    } finally {
      setIsDeleting(false);
    }
  }, [
    activeConversationId,
    conversations,
    deleteAllConversations,
    navigate,
    showNotification,
    t,
  ]);

  const handleCancel = useCallback(() => {
    if (isDeleting) return;
    setIsPopupOpen(false);
    setDeleteError(null);
  }, [isDeleting]);

  return (
    <>
      <PanelMenuTrigger
        items={menuItems}
        label={t(ConversationPanelI18nKeys.PanelActionsLabel)}
      />
      <DialConfirmationPopup
        open={isPopupOpen}
        header={t(ConversationPanelI18nKeys.DeleteAllConfirmTitle)}
        confirmLabel={t(ButtonsI18nKeys.DeleteAll)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        isLoading={isDeleting}
        disableConfirmButton={isDeleting}
        description={
          <>
            <span>
              {t(ConversationPanelI18nKeys.DeleteAllConfirmDescription)}
            </span>
            {deleteError && (
              <span className="mt-1 block text-error">{deleteError}</span>
            )}
          </>
        }
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleCancel}
      />
    </>
  );
};

export default memo(DeleteAllConversationsAction);
