import {
  IconFileArrowLeft,
  IconFileArrowRight,
  IconPaperclip,
  IconScale,
  IconTrashX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { SupportedExportFormats } from '@/src/types/export';
import { Feature } from '@/src/types/features';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import SidebarMenu from '@/src/components/Common/SidebarMenu';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';
import { Import } from '@/src/components/Settings/Import';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

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
        name: t('Create new folder'),
        dataQa: 'create-folder',
        Icon: FolderPlus,
        onClick: () => {
          dispatch(ConversationsActions.createFolder());
        },
      },
      {
        name: t('Import conversations'),
        onClick: (importJSON: unknown) => {
          dispatch(
            ImportExportActions.importConversations({
              data: importJSON as SupportedExportFormats,
            }),
          );
        },
        Icon: IconFileArrowLeft,
        dataQa: 'import',
        CustomTriggerRenderer: Import,
      },
      {
        name: t('Export conversations'),
        dataQa: 'export',
        Icon: IconFileArrowRight,
        onClick: () => {
          dispatch(ImportExportActions.exportConversations());
        },
      },
      {
        name: t('Delete all conversations'),
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
        disabled: isStreaming,
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
    [dispatch, enabledFeatures, handleToggleCompare, isStreaming, t],
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
