import {
  IconFileDescription,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DialFile } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import ContextMenu from '../Common/ContextMenu';
import { FileManagerModal } from './FileManagerModal';
import { PreUploadDialog } from './PreUploadModal';
import { FeatureType } from '@/src/types/common';

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
  const { t } = useTranslation(Translation.Chat);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isModelLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
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
        name: t('Attach uploaded files'),
        dataQa: 'attach_uploaded',
        Icon: IconFileDescription,
        onClick: handleOpenAttachmentsModal,
      },
      {
        name: t('Upload from device'),
        dataQa: 'upload_from_device',
        Icon: IconUpload,
        onClick: handleAttachFromComputer,
      },
    ],
    [handleAttachFromComputer, handleOpenAttachmentsModal, t],
  );

  return (
    <>
      <ContextMenu
        menuItems={menuItems}
        TriggerIcon={IconPaperclip}
        triggerIconSize={24}
        triggerTooltip={t('Attach files') || ''}
        disabled={messageIsStreaming || !isModelLoaded}
        triggerIconHighlight
        featureType={FeatureType.File}
      />
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          isInConversation
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
          initialFilesSelect
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
