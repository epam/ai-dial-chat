import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconPaperclip,
  IconScale,
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
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { Feature } from '@epam/ai-dial-shared';

export const ChatbarSettings = () => {
  const { t } = useTranslation(Translation.SideBar);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const dispatch = useAppDispatch();

  const isStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
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

  const handleToggleCompare = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME, DEFAULT_CONVERSATION_NAME],
      }),
    );
  }, [dispatch]);

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
        name: t('Create new folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(
            ConversationsActions.createFolder({
              parentId: getConversationRootId(),
            }),
          );
        },
      },
      {
        name: t('Import conversations'),
        onClick: (importArgs: unknown) => {
          const typedArgs = importArgs as { content: unknown; zip?: boolean };

          if (!typedArgs.zip) {
            jsonImportHandler(typedArgs.content as SupportedExportFormats);
          }
          if (typedArgs.zip) {
            zipImportHandler(typedArgs.content as File);
          }
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        name: t('Export conversations without attachments'),
        dataQa: 'export',
        className: 'max-w-[158px]',
        Icon: IconFileArrowRight,
        display: isMyItemsExist,
        onClick: () => {
          dispatch(ImportExportActions.exportConversations());
        },
      },
      {
        name: t('Delete all conversations'),
        display: isMyItemsExist,
        dataQa: 'delete-entities',
        Icon: IconTrashX,
        onClick: () => {
          setIsClearModalOpen(true);
        },
      },
      {
        name: t('Compare mode'),
        dataQa: 'compare',
        Icon: IconScale,
        disabled: isStreaming || isActiveNewConversationRequest,
        onClick: () => {
          handleToggleCompare();
        },
      },
      {
        name: t('Attachments'),
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
      t,
      isMyItemsExist,
      isStreaming,
      isActiveNewConversationRequest,
      enabledFeatures,
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
          headerLabel={t('Manage attachments')}
          forceShowSelectCheckBox
        />
      )}

      <ConfirmDialog
        isOpen={isClearModalOpen}
        heading={t('Confirm clearing all conversations')}
        description={
          t('Are you sure that you want to delete all conversations?') || ''
        }
        confirmLabel={t('Clear')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsClearModalOpen(false);
          if (result) {
            dispatch(ConversationsActions.clearConversations());
          }
        }}
      />
    </>
  );
};
