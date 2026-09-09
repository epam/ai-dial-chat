import type { FC } from 'react';
import { Suspense, useCallback } from 'react';
import type { AvatarPickerModalProps } from '../../models/avatar-picker-modal';

/** File manager modal restricted to a single image up to a host-configured size, for picking an entity's avatar. */
export const AvatarPickerModal: FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  onAttach,
  bucket,
  FileManagerModal,
  allowedMimeTypes,
  maxFileSizeBytes,
  labels,
}) => {
  const deleteConfirmTitle = useCallback(
    (names: string[]) =>
      names.length === 1
        ? labels.deleteConfirmTitleSingle
        : labels.deleteConfirmTitleMultiple,
    [labels.deleteConfirmTitleSingle, labels.deleteConfirmTitleMultiple],
  );

  const deleteConfirmBody = useCallback(
    (names: string[]) => (
      <div className="dial-small-text px-6 py-3">
        <p className="mb-3 text-secondary">
          {names.length === 1 ? (
            <>
              {labels.deleteConfirmSingleText}{' '}
              <span className="break-words text-primary">
                &quot;{names[0].split('/').pop()}&quot;?
              </span>
            </>
          ) : (
            <>
              {labels.deleteConfirmMultipleText}{' '}
              <span className="text-primary">
                {names.length} {labels.deleteConfirmItemsLabel}
              </span>
            </>
          )}
        </p>
      </div>
    ),
    [
      labels.deleteConfirmSingleText,
      labels.deleteConfirmMultipleText,
      labels.deleteConfirmItemsLabel,
    ],
  );

  return (
    <Suspense fallback={null}>
      {isOpen && (
        <FileManagerModal
          isOpen={isOpen}
          onClose={onClose}
          onAttach={onAttach}
          bucket={bucket}
          allowedTypes={allowedMimeTypes}
          maxSelectableFileSize={maxFileSizeBytes}
          maximumAttachmentsAmount={1}
          canAttachFolders={false}
          title={labels.title}
          attachLabel={labels.attachLabel}
          emptyTitle={labels.emptyTitle}
          emptyDescription={labels.emptyDescription}
          errorMessage={labels.errorMessage}
          retryLabel={labels.retryLabel}
          hiddenFilesLabel={labels.hiddenFilesLabel}
          showHiddenFilesLabel={labels.showHiddenFilesLabel}
          hideHiddenFilesLabel={labels.hideHiddenFilesLabel}
          getSelectionLabel={labels.getSelectionLabel}
          uploadFilesLabel={labels.uploadFilesLabel}
          newFolderLabel={labels.newFolderLabel}
          downloadLabel={labels.downloadLabel}
          downloadingLabel={labels.downloadingLabel}
          deleteLabel={labels.deleteLabel}
          deletingLabel={labels.deletingLabel}
          deleteConfirmTitle={deleteConfirmTitle}
          deleteConfirmBody={deleteConfirmBody}
          deleteConfirmLabel={labels.deleteConfirmLabel}
          deleteCancelLabel={labels.deleteCancelLabel}
          uploadProgressTitle={labels.uploadProgressTitle}
          cancelLabel={labels.cancelLabel}
        />
      )}
    </Suspense>
  );
};
