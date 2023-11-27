import {
  IconFileDescription,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { HighlightColor } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import BaseContextMenu from '../../Common/BaseContextMenu';
import { FileManagerModal } from '../../Files/FileManagerModal';
import { PreUploadDialog } from '../../Files/PreUploadModal';

export const AttachButton = () => {
  const dispatch = useAppDispatch();
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

  const handleFileSelectClose = useCallback(
    (result: unknown) => {
      if (typeof result === 'object') {
        const selectedFilesIds = result as string[];
        dispatch(FilesActions.resetSelectedFiles());
        dispatch(
          FilesActions.selectFiles({
            ids: selectedFilesIds,
          }),
        );
      }
      setIsSelectFilesDialogOpened(false);
    },
    [dispatch],
  );

  const handlePreUploadModalClose = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
      folderPath: string | undefined,
    ) => {
      selectedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
          }),
        );
      });
      dispatch(
        FilesActions.selectFiles({
          ids: selectedFiles.map(({ id }) => id),
        }),
      );
    },
    [dispatch],
  );

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
      <div className="absolute left-4 top-[calc(50%_-_12px)] rounded disabled:cursor-not-allowed">
        <BaseContextMenu
          menuItems={menuItems}
          ContextMenuIcon={IconPaperclip}
          contextMenuIconSize={24}
          contextMenuTooltip="Attach files"
          translation="chat"
          highlightColor={HighlightColor.Blue}
          disabled={messageIsStreaming || isModelsLoading}
          contextMenuIconHighlight
        />
      </div>
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          isInConversation={true}
          onClose={handleFileSelectClose}
        />
      )}
      {isPreUploadDialogOpened && (
        <PreUploadDialog
          isOpen
          allowedTypes={availableAttachmentsTypes}
          initialFilesSelect={true}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onUploadFiles={handlePreUploadModalClose}
          onClose={() => {
            setIsPreUploadDialogOpened(false);
          }}
        />
      )}
    </>
  );
};
