import { Placement } from '@floating-ui/react';
import {
  IconFileDescription,
  IconFolder,
  IconLink,
  IconPaperclip,
  IconUpload,
} from '@tabler/icons-react';
import { JSX, useCallback, useMemo, useState } from 'react';

import { useIsPublicationReview } from '@/src/hooks/useIsPublicationReview';
import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { DialLink, FileSourceType } from '@/src/types/files';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, ModelsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { ContextMenu } from '@/src/components/Common/ContextMenu';

import { AttachLinkDialog } from './AttachLinkDialog';
import { FileManagerModal } from './FileManagerModal';

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
  onAddLinkToMessage: (link: DialLink) => void;
}

export const AttachButton = ({
  selectedFilesIds,
  TriggerCustomRenderer,
  contextMenuPlacement,
  onSelectAlreadyUploaded,
  onAddLinkToMessage,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isModelLoaded = useAppSelector(ModelsSelectors.selectAreModelsLoaded);
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
    (a, b) => a?.join() === b?.join(),
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

  const isPublicationReview = useIsPublicationReview();

  const [isPreUploadDialogOpened, setIsPreUploadDialogOpened] = useState(false);
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const [isAttachLinkDialogOpened, setIsAttachLinkDialogOpened] =
    useState(false);

  const handleOpenAttachmentsModal = useCallback(() => {
    setIsSelectFilesDialogOpened(true);
  }, []);

  const handleAttachFromComputer = useCallback(() => {
    setIsSelectFilesDialogOpened(true);
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
      setIsPreUploadDialogOpened(false);
    },
    [onSelectAlreadyUploaded],
  );

  const sourceFilters = isPublicationReview
    ? reviewFilesFilter
    : defaultFilesFilter;

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
          isPreUploadOpen={isPreUploadDialogOpened}
        />
      )}
      {/*{isPreUploadDialogOpened && (*/}
      {/*  <PreUploadDialog*/}
      {/*    isOpen*/}
      {/*    allowedTypes={availableAttachmentsTypes}*/}
      {/*    initialFilesSelect*/}
      {/*    maximumAttachmentsAmount={maximumAttachmentsAmount}*/}
      {/*    onUploadFiles={onUploadFromDevice}*/}
      {/*    onClose={() => {*/}
      {/*      setIsPreUploadDialogOpened(false);*/}
      {/*    }}*/}
      {/*    uploadFolderId={getQuickAttachmentsSavingPath()}*/}
      {/*  />*/}
      {/*)}*/}
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
