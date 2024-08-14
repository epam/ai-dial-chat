import { Placement } from '@floating-ui/react';
import {
  IconFileDescription,
  IconFolder,
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
  TriggerCustomRenderer?: JSX.Element;
  contextMenuPlacement?: Placement;
}

export const AttachButton = ({
  selectedFilesIds,
  onSelectAlreadyUploaded,
  onUploadFromDevice,
  onAddLinkToMessage,
  TriggerCustomRenderer,
  contextMenuPlacement,
}: Props) => {
  const { t } = useTranslation(Translation.Files);
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
  const canAttachFolders = useAppSelector(
    ConversationsSelectors.selectCanAttachFolders,
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
          name:
            canAttachFiles && canAttachFolders
              ? t('files.button.attach_folders_and_uploaded_files')
              : canAttachFolders
                ? t('files.button.attach_folders')
                : canAttachFiles
                  ? t('files.button.attach_uploaded_files')
                  : t('files.button.attach'),
          dataQa: 'attach_uploaded',
          display: canAttachFiles || canAttachFolders,
          Icon: !canAttachFiles ? IconFolder : IconFileDescription,
          onClick: handleOpenAttachmentsModal,
        },
        {
          name: t('files.button.upload_from_device'),
          dataQa: 'upload_from_device',
          display: canAttachFiles,
          Icon: IconUpload,
          onClick: handleAttachFromComputer,
        },
        {
          name: t('files.button.attach_link'),
          dataQa: 'attach_link',
          display: canAttachLinks,
          Icon: IconLink,
          onClick: handleAttachLink,
        },
      ] as DisplayMenuItemProps[],
    [
      canAttachFiles,
      canAttachFolders,
      canAttachLinks,
      handleAttachFromComputer,
      handleAttachLink,
      handleOpenAttachmentsModal,
      t,
    ],
  );

  if (!canAttachFiles && !canAttachFolders && !canAttachLinks) return null;

  const label = canAttachFiles
    ? t('files.button.attach_files')
    : canAttachFolders
      ? t('files.button.attach_folders')
      : '';

  return (
    <>
      <ContextMenu
        placement={contextMenuPlacement}
        menuItems={menuItems}
        TriggerCustomRenderer={TriggerCustomRenderer}
        TriggerIcon={IconPaperclip}
        triggerIconSize={24}
        triggerTooltip={t(label) || ''}
        disabled={messageIsStreaming || !isModelLoaded}
        triggerIconHighlight
        featureType={FeatureType.File}
      />
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          headerLabel={t(label)}
          customButtonLabel={t('files.button.attach_files') as string}
          customUploadButtonLabel={
            t('files.button.upload_and_attach_files') as string
          }
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
          customUploadButtonLabel={
            t('files.button.upload_and_attach_files') as string
          }
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
