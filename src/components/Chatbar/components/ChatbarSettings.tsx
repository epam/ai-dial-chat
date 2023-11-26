import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconPaperclip,
  IconScale,
  IconTrashX,
  IconUserShare,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { DisplayMenuItemProps } from '@/src/types/menu';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

export const ChatbarSettings = () => {
  const { t } = useTranslation('sidebar');
  const [isOpen, setIsOpen] = useState(false);

  const dispatch = useAppDispatch();

  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );

  const handleToggleCompare = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME, DEFAULT_CONVERSATION_NAME],
      }),
    );
  }, [dispatch]);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: 'Shared by me',
        display:
          enabledFeatures.has(Feature.ConversationsSharing) &&
          conversations.filter((c) => c.isShared).length > 0,
        dataQa: 'shared-by-me',
        Icon: IconUserShare,
        onClick: () => {
          setIsOpen(false);
        }, //TODO
      },
      {
        name: 'Delete all conversations',
        display: conversations.length > 0,
        dataQa: 'delete-conversations',
        Icon: IconTrashX,
        onClick: () => {
          setIsOpen(true);
        },
      },
      {
        name: 'Import conversations',
        onClick: (importJSON) => {
          dispatch(
            ConversationsActions.importConversations({ data: importJSON }),
          );
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        name: 'Export conversations',
        dataQa: 'export-conversations',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(ConversationsActions.exportConversations());
        },
      },
      {
        name: 'Create new folder',
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(
            ConversationsActions.createFolder({ name: t('New folder') }),
          );
        },
      },
      {
        name: 'Compare mode',
        dataQa: 'compare',
        Icon: IconScale,
        disabled: isStreaming,
        onClick: () => {
          handleToggleCompare();
        },
      },
      {
        name: 'Attachments',
        display: enabledFeatures.has(Feature.AttachmentsManager),
        dataQa: 'attachments',
        Icon: IconPaperclip,
        disabled: isStreaming,
        onClick: () => {
          setIsSelectFilesDialogOpened(true);
        },
      },
    ],
    [
      conversations,
      dispatch,
      enabledFeatures,
      handleToggleCompare,
      isStreaming,
      t,
    ],
  );

  return (
    <>
      <SidebarMenu
        menuItems={menuItems}
        highlightColor={HighlightColor.Green}
        translation="sidebar"
      />

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={() => {
            setIsSelectFilesDialogOpened(false);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={isOpen}
        heading={t('Confirm clearing all conversations')}
        description={
          t('Are you sure that you want to delete all conversations?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsOpen(false);
          if (result) {
            dispatch(ConversationsActions.clearConversations());
          }
        }}
      />
    </>
  );
};
