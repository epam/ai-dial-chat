import { Placement } from '@floating-ui/react';
import {
  IconFileDescription,
  IconFolder,
  IconLink,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { JSX, useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';

import { FeatureType } from '@/src/types/common';
import { DialFile, DialLink, FileSourceType } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { AttachLinkDialog } from './AttachLinkDialog';
import { FileManagerModal } from './FileManagerModal';
import { PreUploadDialog } from './PreUploadModal';

const reviewFilesFilter = new Set([
  FileSourceType.MY_FILES,
  FileSourceType.REVIEW_FILES,
]);
const defaultFilesFilter = new Set([
  FileSourceType.MY_FILES,
  FileSourceType.PUBLIC,
  FileSourceType.SHARED_WITH_ME,
]);

interface Props {
  selectedFilesIds?: string[];
  TriggerCustomRenderer?: JSX.Element;
  contextMenuPlacement?: Placement;
  onSelectAlreadyUploaded: (result: string[]) => void;
  onUploadFromDevice: (
    selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
    folderPath: string | undefined,
  ) => void;
  onAddLinkToMessage: (link: DialLink) => void;
}

export const AttachButton = ({
  selectedFilesIds,
  TriggerCustomRenderer,
  contextMenuPlacement,
  onSelectAlreadyUploaded,
  onUploadFromDevice,
  onAddLinkToMessage,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const selectedConversationIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const resourcesToReview = useAppSelector(
    PublicationSelectors.selectResourcesToReview,
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isModelLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);
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

  const handleCloseFileManagerModal = useCallback(
    (result: boolean | string[]) => {
      if (typeof result !== 'boolean') {
        onSelectAlreadyUploaded(result);
      }

      setIsSelectFilesDialogOpened(false);
    },
    [onSelectAlreadyUploaded],
  );

  const isApproveRequiredEntity = useMemo(
    () =>
      resourcesToReview.some((r) =>
        selectedConversationIds.includes(r.reviewUrl),
      ),
    [resourcesToReview, selectedConversationIds],
  );

  const sourceFilters =
    isApproveRequiredEntity && isAdmin ? reviewFilesFilter : defaultFilesFilter;

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () =>
      [
        {
          name: t(
            canAttachFiles && canAttachFolders
              ? ChatI18nKeys.AttachFoldersAndUploadedFiles
              : canAttachFolders
                ? ChatI18nKeys.AttachFolders
                : ChatI18nKeys.AttachUploadedFiles,
          ),
          dataQa: 'attach_uploaded',
          display: canAttachFiles || canAttachFolders,
          Icon: !canAttachFiles ? IconFolder : IconFileDescription,
          onClick: handleOpenAttachmentsModal,
        },
        {
          name: t(ChatI18nKeys.UploadFromDevice),
          dataQa: 'upload_from_device',
          display: canAttachFiles,
          Icon: IconUpload,
          onClick: handleAttachFromComputer,
        },
        {
          name: t(ChatI18nKeys.AttachLink),
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
    ? ChatI18nKeys.AttachFiles
    : canAttachFolders
      ? ChatI18nKeys.AttachFolders
      : '';

  return (
    <>
      <ContextMenu
        placement={contextMenuPlacement}
        menuItems={menuItems}
        TriggerCustomRenderer={TriggerCustomRenderer}
        TriggerIcon={IconPaperclip}
        triggerIconSize={DEFAULT_ICON_SIZES.STANDARD}
        triggerTooltip={t(label)}
        disabled={messageIsStreaming || !isModelLoaded}
        triggerIconHighlight
        featureType={FeatureType.File}
      />
      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen={isSelectFilesDialogOpened}
          sourceFilters={sourceFilters}
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          headerLabel={t(label)}
          customButtonLabel={t(ChatI18nKeys.Attach)}
          selectedFilesIds={selectedFilesIds}
          onClose={handleCloseFileManagerModal}
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
          uploadFolderId={getQuickAttachmentsSavingPath()}
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
