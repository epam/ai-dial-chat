import { type ComponentProps, type FC, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import { useConversationDeploymentState } from '../../hooks/conversation/useConversationDeploymentState';
import FileDeleteConfirmContent from '../FileDeleteConfirmContent/FileDeleteConfirmContent';

const DialFileManagerModal = lazy(async () => {
  const module = await import('../DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

type DialFileManagerModalProps = ComponentProps<typeof DialFileManagerModal>;

interface ConversationFileManagerModalProps {
  isDialFileManagerOpen: boolean;
  closeDialFileManager: DialFileManagerModalProps['onClose'];
  handleAttachDialFiles: DialFileManagerModalProps['onAttach'];
  bucket: DialFileManagerModalProps['bucket'];
  inputAttachmentTypes: DialFileManagerModalProps['allowedTypes'];
  maxAttachmentFileSizeBytes: DialFileManagerModalProps['maxSelectableFileSize'];
  selectedDeployment: ReturnType<
    typeof useConversationDeploymentState
  >['selectedDeployment'];
  /* Attachments already in the composer, counted against the deployment's limit. */
  attachmentsAmount: number;
}

/**
 * The DIAL file-system picker opened from the conversation composer or a
 * message being edited: one lazily loaded `DialFileManagerModal`, mounted
 * only while open, with its labels. Presentational.
 */
const ConversationFileManagerModal: FC<ConversationFileManagerModalProps> = ({
  isDialFileManagerOpen,
  closeDialFileManager,
  handleAttachDialFiles,
  bucket,
  inputAttachmentTypes,
  maxAttachmentFileSizeBytes,
  selectedDeployment,
  attachmentsAmount,
}) => {
  const { t } = useTranslation();

  return (
    <Suspense fallback={null}>
      {isDialFileManagerOpen && (
        <DialFileManagerModal
          isOpen={isDialFileManagerOpen}
          onClose={closeDialFileManager}
          onAttach={handleAttachDialFiles}
          bucket={bucket}
          allowedTypes={inputAttachmentTypes}
          maxSelectableFileSize={maxAttachmentFileSizeBytes}
          maximumAttachmentsAmount={selectedDeployment?.maxInputAttachments}
          existingAttachmentsAmount={attachmentsAmount}
          canAttachFolders={selectedDeployment?.features?.folderAttachments}
          title={t(BasicI18nKeys.AttachFiles)}
          attachLabel={t(DialFileManagerI18nKeys.Attach)}
          emptyTitle={t(DialFileManagerI18nKeys.Empty)}
          emptyDescription=""
          errorMessage={t(DialFileManagerI18nKeys.Error)}
          retryLabel={t(ButtonsI18nKeys.Retry)}
          hiddenFilesLabel={t(DialFileManagerI18nKeys.HiddenFiles)}
          showHiddenFilesLabel={t(DialFileManagerI18nKeys.ShowHiddenFiles)}
          hideHiddenFilesLabel={t(DialFileManagerI18nKeys.HideHiddenFiles)}
          getSelectionLabel={(count) =>
            t(DialFileManagerI18nKeys.ItemsSelected, { count })
          }
          uploadFilesLabel={t(DialFileManagerI18nKeys.Upload)}
          newFolderLabel={t(DialFileManagerI18nKeys.NewFolder)}
          downloadLabel={t(ButtonsI18nKeys.Download)}
          downloadingLabel={t(DialFileManagerI18nKeys.Downloading)}
          deleteLabel={t(ButtonsI18nKeys.Delete)}
          deletingLabel={t(BasicI18nKeys.DeletingStatus)}
          deleteConfirmBody={(names) => (
            <FileDeleteConfirmContent names={names} />
          )}
          deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
          deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
        />
      )}
    </Suspense>
  );
};

export default ConversationFileManagerModal;
