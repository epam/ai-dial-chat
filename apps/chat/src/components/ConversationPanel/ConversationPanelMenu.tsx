import {
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  ConfirmationPopup,
  Dropdown,
  ElementSize,
  GhostIconButton,
  NotificationVariant,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconDotsVertical,
  IconFileArrowLeft,
  IconFileArrowRight,
  IconTrashX,
} from '@tabler/icons-react';
import { memo, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  ButtonsI18nKeys,
  ConversationExportI18nKeys,
  ConversationImportI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../types/routes';

interface PanelMenuTriggerProps {
  items: DropdownItem[];
  label: string;
}

const PanelMenuTrigger: FC<PanelMenuTriggerProps> = ({ items, label }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown items={items} placement="bottom-end" onOpenChange={setIsOpen}>
      <GhostIconButton
        aria-label={label}
        size={ElementSize.Small}
        icon={
          <IconDotsVertical
            size={DIAL_ICON_SIZE.SM}
            className={isOpen ? 'text-accent' : 'text-secondary'}
          />
        }
        className={isOpen ? 'bg-control-accent-alpha-hover' : undefined}
      />
    </Dropdown>
  );
};

interface Props {
  activeConversationId?: string;
  onExportAll: () => void;
  onImport: () => void;
}

const ConversationPanelMenu: FC<Props> = ({
  activeConversationId,
  onExportAll,
  onImport,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteAllConversations } = useConversations();
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
        key: 'export-all',
        label: t(ConversationExportI18nKeys.ExportAllLabel),
        icon: (
          <IconFileArrowRight
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
          />
        ),
        onClick: onExportAll,
      },
      {
        key: 'import',
        label: t(ConversationImportI18nKeys.ImportLabel),
        icon: (
          <IconFileArrowLeft
            size={DIAL_ICON_SIZE.SM}
            className="text-secondary"
          />
        ),
        onClick: onImport,
      },
      {
        key: 'delete-all',
        label: t(ConversationPanelI18nKeys.DeleteAllChatsLabel),
        icon: (
          <IconTrashX size={DIAL_ICON_SIZE.SM} className="text-secondary" />
        ),
        onClick: handleOpen,
      },
    ],
    [handleOpen, onExportAll, onImport, t],
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

      if (activeConversationId) {
        navigate(ROUTES.Root);
      }

      showNotification({
        variant: NotificationVariant.Success,
        title: t(ConversationPanelI18nKeys.DeleteAllSuccessTitle),
        message: t(ConversationPanelI18nKeys.DeleteAllSuccess),
      });
    } catch {
      setDeleteError(t(ConversationPanelI18nKeys.DeleteAllError));
    } finally {
      setIsDeleting(false);
    }
  }, [
    activeConversationId,
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
      <ConfirmationPopup
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

export default memo(ConversationPanelMenu);
