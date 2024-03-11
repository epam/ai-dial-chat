import {
  IconFileDescription,
  IconLink,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { DialFile, DialLink } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import ContextMenu from '../Common/ContextMenu';
import { AttachLinkDialog } from './AttachLinkDialog';
import { FileManagerModal } from './FileManagerModal';
import { PreUploadDialog } from './PreUploadModal';

interface Props {
  selectedFilesIds?: string[];
  onSelectAlreadyUploaded: (result: unknown) => void;
  onUploadFromDevice: (
    selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
    folderPath: string | undefined,
  ) => void;
  onAddLinkToMessage: (link: DialLink) => void;
}

export const AttachButton = ({
  selectedFilesIds,
  onSelectAlreadyUploaded,
  onUploadFromDevice,
  onAddLinkToMessage,
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
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );
  const canAttachLinks = useAppSelector(
    ConversationsSelectors.selectCanAttachLink,
  );
  const [isPreUploadDialogOpened, setIsPreUploadDialogOpened] = useState(false);
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const [isAttachLinkDialogOpened, setIsAttachLinkDialogOpened] =
    useState(false);

  const handleOpenAttachmentsModal = useCallback(() => {
    setIsSelectFilesDialogOpened(true);
  }, []);
  const handleAttachFromComputer = useCallback(() => {
    setIsPreUploadDialogOpened(true);
  }, []);
  const handleAttachLink = useCallback(() => {
    setIsAttachLinkDialogOpened(true);
  }, []);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () =>
      [
        {
          name: t('Attach uploaded files'),
          dataQa: 'attach_uploaded',
          display: canAttachFiles,
          Icon: IconFileDescription,
          onClick: handleOpenAttachmentsModal,
        },
        {
          name: t('Upload from device'),
          dataQa: 'upload_from_device',
          display: canAttachFiles,
          Icon: IconUpload,
          onClick: handleAttachFromComputer,
        },
        {
          name: t('Attach link'),
          dataQa: 'attach_link',
          display: canAttachLinks,
          Icon: IconLink,
          onClick: handleAttachLink,
        },
      ] as DisplayMenuItemProps[],
    [
      canAttachFiles,
      canAttachLinks,
      handleAttachFromComputer,
      handleAttachLink,
      handleOpenAttachmentsModal,
      t,
    ],
  );

  if (!canAttachFiles && !canAttachLinks) return null;

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
          headerLabel={t('Attach files')}
          customButtonLabel={t('Attach files') as string}
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
      {isAttachLinkDialogOpened && (
        <AttachLinkDialog
          onClose={(link?: DialLink) => {
            if (link) {
              onAddLinkToMessage(link);
            }
            setIsAttachLinkDialogOpened(false);
          }}
        />
      )}
    </>
  );
};
