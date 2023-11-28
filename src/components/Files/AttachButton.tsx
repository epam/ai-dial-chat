import {
  IconFileDescription,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DialFile } from '@/src/types/files';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { Menu, MenuItem } from '../Common/DropdownMenu';
import Tooltip from '../Common/Tooltip';
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

  return (
    <>
      <Menu
        type="contextMenu"
        disabled={messageIsStreaming || isModelsLoading}
        trigger={
          <Tooltip isTriggerClickable tooltip={t('Attach files')}>
            <IconPaperclip
              className="text-gray-500 hover:text-blue-500"
              size={24}
            />
          </Tooltip>
        }
      >
        <MenuItem
          className="hover:bg-blue-500/20"
          item={
            <div className="flex items-center gap-3">
              <IconFileDescription
                className="shrink-0 text-gray-500"
                size={18}
              />
              <span>{t('Attach uploaded files')}</span>
            </div>
          }
          onClick={handleOpenAttachmentsModal}
        />
        <MenuItem
          className="hover:bg-blue-500/20"
          item={
            <div className="flex items-center gap-3">
              <IconUpload className="shrink-0 text-gray-500" size={18} />
              <span>{t('Upload from device')}</span>
            </div>
          }
          onClick={handleAttachFromComputer}
        />
      </Menu>
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
