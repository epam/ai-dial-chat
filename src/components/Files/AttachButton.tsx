import {
  IconFileDescription,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import ContextMenu from '../Common/ContextMenu';
import { FileManagerModal } from './FileManagerModal';
import { PreUploadDialog } from './PreUploadModal';

interface Props {
  selectedFilesIds?: string[];
  onSelectAlreadyUploaded: (result: unknown) => void;
  onUploadFromDevice: (
    selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
    folderPath: string | undefined,
  ) => void;
}

export const AttachButton = ({
  selectedFilesIds,
  onSelectAlreadyUploaded,
  onUploadFromDevice,
}: Props) => {
  const { t } = useTranslation('chat');
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const [isPreUploadDialogOpened, setIsPreUploadDialogOpened] = useState(false);
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);

  const handleOpenAttachmentsModal = useCallback(() => {
    setIsSelectFilesDialogOpened(true);
  }, []);
  const handleAttachFromComputer = useCallback(() => {
    setIsPreUploadDialogOpened(true);
  }, []);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: 'Attach uploaded files',
        dataQa: 'attach_uploaded',
        Icon: IconFileDescription,
        onClick: handleOpenAttachmentsModal,
      },
      {
        name: 'Upload from device',
        dataQa: 'upload_from_device',
        Icon: IconUpload,
        onClick: handleAttachFromComputer,
      },
    ],
    [handleAttachFromComputer, handleOpenAttachmentsModal],
  );

  return (
    <>
      <ContextMenu
        menuItems={menuItems}
        ContextMenuIcon={IconPaperclip}
        contextMenuIconSize={24}
        contextMenuTooltip={t('Attach files') || ''}
        translation="chat"
        highlightColor={HighlightColor.Blue}
        disabled={messageIsStreaming || isModelsLoading}
        contextMenuIconHighlight
      />
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          isInConversation={true}
          initialSelectedFilesIds={selectedFilesIds}
          onClose={(result: unknown) => {
            onSelectAlreadyUploaded(result);
            setIsSelectFilesDialogOpened(false);
          }}
        />
      )}
      {isPreUploadDialogOpened && (
        <PreUploadDialog
          isOpen
          allowedTypes={availableAttachmentsTypes}
          initialFilesSelect={true}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onUploadFiles={onUploadFromDevice}
          onClose={() => {
            setIsPreUploadDialogOpened(false);
          }}
        />
      )}
    </>
  );
};
