import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconPaperclip,
  IconScale,
  IconSquareCheck,
  IconSquareOff,
  IconTrashX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getConversationRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { SupportedExportFormats } from '@/src/types/import-export';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

export const ChatbarSettings = () => {
  const { t } = useTranslation(Translation.ChatBar);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const dispatch = useAppDispatch();

  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const isActiveNewConversationRequest = useAppSelector(
    ConversationsSelectors.selectIsActiveNewConversationRequest,
  );
  const isMyItemsExist = useAppSelector(
    ConversationsSelectors.selectDoesAnyMyItemExist,
  );
  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );

  const handleToggleCompare = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [
          t(DEFAULT_CONVERSATION_NAME, { ns: Translation.Common }),
          t(DEFAULT_CONVERSATION_NAME, { ns: Translation.Common }),
        ],
      }),
    );
  }, [dispatch, t]);

  const jsonImportHandler = useCallback(
    (jsonContent: SupportedExportFormats) => {
      dispatch(
        ImportExportActions.importConversations({
          data: jsonContent as SupportedExportFormats,
        }),
      );
    },
    [dispatch],
  );

  const zipImportHandler = useCallback(
    (zipFile: File) => {
      dispatch(ImportExportActions.importZipConversations({ zipFile }));
    },
    [dispatch],
  );

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Select all'),
        dataQa: 'select-all',
        Icon: IconSquareCheck,
        onClick: () => {
          dispatch(ConversationsActions.setAllChosenConversations());
        },
        display: false,
      },
      {
        name: t('Unselect all'),
        dataQa: 'unselect-all',
        Icon: IconSquareOff,
        onClick: () => {
          dispatch(ConversationsActions.resetChosenConversations());
        },
        display: isSelectMode,
      },
      {
        name: t('chatbar.button.create_new_folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        display: false,
        onClick: () => {
          dispatch(
            ConversationsActions.createFolder({
              parentId: getConversationRootId(),
            }),
          );
        },
      },
      {
        name: t('chatbar.button.import_conversations'),
        onClick: (importArgs: unknown) => {
          const typedArgs = importArgs as { content: unknown; zip?: boolean };

          if (!typedArgs.zip) {
            jsonImportHandler(typedArgs.content as SupportedExportFormats);
          }
          if (typedArgs.zip) {
            zipImportHandler(typedArgs.content as File);
          }
        },
        display: false,
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        name: t('chatbar.button.export_conversations_without_attachments'),
        dataQa: 'export',
        className: 'max-w-[158px]',
        Icon: IconFileArrowRight,
        display: false,
        onClick: () => {
          dispatch(ImportExportActions.exportConversations());
        },
      },
      {
        name: t('chatbar.button.delete_all_conversations'),
        display: isMyItemsExist,
        dataQa: 'delete-entities',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
      },
      {
        name: t('chatbar.button.compare_mode'),
        dataQa: 'compare',
        Icon: IconScale,
        display: false,
        disabled: isStreaming || isActiveNewConversationRequest,
        onClick: () => {
          handleToggleCompare();
        },
      },
      {
        name: t('chatbar.button.attachments'),
        display: false,
        dataQa: 'attachments',
        Icon: IconPaperclip,
        disabled: isStreaming,
        onClick: () => {
          setIsSelectFilesDialogOpened(true);
        },
      },
    ],
    [
      t,
      isSelectMode,
      isMyItemsExist,
      isStreaming,
      isActiveNewConversationRequest,
      dispatch,
      jsonImportHandler,
      zipImportHandler,
      handleToggleCompare,
    ],
  );

  return (
    <>
      <SidebarMenu menuItems={menuItems} featureType={FeatureType.Chat} />

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={['*/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={() => {
            setIsSelectFilesDialogOpened(false);
          }}
          headerLabel={t('chatbar.button.manage_attachments')}
          forceShowSelectCheckBox
          forceHideSelectFolders
          showTooltip
        />
      )}

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t('chatbar.dialog.confirm_clearing_all_conversations.header')}
        description={
          t('chatbar.dialog.confirm_clearing_all_conversations.description') ||
          ''
        }
        confirmLabel={t(
          'chatbar.dialog.confirm_clearing_all_conversations.button.clear',
        )}
        cancelLabel={t('chatbar.dialog.button.cancel')}
        onClose={(result) => {
          setIsClearModalOpen(false);
          if (result) {
            if (!isSelectMode) {
              dispatch(ConversationsActions.clearConversations());
            } else {
              dispatch(ConversationsActions.deleteChosenConversations());
            }
          }
        }}
      />
    </>
  );
};
