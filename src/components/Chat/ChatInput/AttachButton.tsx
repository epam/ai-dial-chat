import {
  IconFileDescription,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DialFile } from '@/src/types/files';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Menu, MenuItem } from '../../Common/DropdownMenu';
import { FileSelect } from '../../Files/FileSelect';
import { PreUploadDialog } from '../../Files/PreUploadModal';

export const AttachButton = () => {
  const dispatch = useAppDispatch();
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

  return (
    <>
      <div className="absolute left-4 top-[calc(50%_-_12px)] rounded disabled:cursor-not-allowed">
        <Menu
          type="contextMenu"
          disabled={messageIsStreaming || isModelsLoading}
          trigger={<IconPaperclip className="text-gray-500" size={24} />}
        >
          <MenuItem
            className="hover:bg-violet/15"
            item={
              <div className="flex items-center gap-3">
                <IconFileDescription
                  className="shrink-0 text-gray-500"
                  size={24}
                />
                <span>{t('Attach uploaded files')}</span>
              </div>
            }
            onClick={handleOpenAttachmentsModal}
          />
          <MenuItem
            className="hover:bg-violet/15"
            item={
              <div className="flex items-center gap-3">
                <IconUpload className="shrink-0 text-gray-500" size={24} />
                <span>{t('Upload from device')}</span>
              </div>
            }
            onClick={handleAttachFromComputer}
          />
        </Menu>
      </div>
      {isSelectFilesDialogOpened && (
        <FileSelect
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={(result) => {
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
          }}
        />
      )}
      {isPreUploadDialogOpened && (
        <PreUploadDialog
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onUploadFiles={(
            selectedFiles: Required<
              Pick<DialFile, 'fileContent' | 'id' | 'name'>
            >[],
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
          }}
          onClose={() => {
            setIsPreUploadDialogOpened(false);
          }}
        />
      )}
    </>
  );
};
