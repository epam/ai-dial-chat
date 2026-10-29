import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { Suspense, useCallback } from 'react';
import type { AvatarPickerModalProps } from '../../models/avatar-picker-modal';
import styles from './AvatarPickerModal.module.scss';

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
  styles: stylesProp,
}) => {
  const confirmTextColor = stylesProp?.colors?.confirmText;
  const confirmItemTextColor = stylesProp?.colors?.confirmItemText;

  const deleteConfirmTitle = useCallback(
    (names: string[]) =>
      names.length === 1
        ? labels.deleteConfirmTitleSingle
        : labels.deleteConfirmTitleMultiple,
    [labels.deleteConfirmTitleSingle, labels.deleteConfirmTitleMultiple],
  );

  const deleteConfirmBody = useCallback(
    (names: string[]) => (
      <div
        className="dial-small-text px-6 py-3"
        style={buildCssVars({
          '--apm-confirm-text': confirmTextColor,
          '--apm-confirm-item-text': confirmItemTextColor,
        })}
      >
        <p className={mergeClasses('mb-3', styles.confirmText)}>
          {names.length === 1 ? (
            <>
              {labels.deleteConfirmSingleText}{' '}
              <span
                className={mergeClasses('wrap-break-word', styles.confirmItem)}
              >
                &quot;{names[0].split('/').pop()}&quot;?
              </span>
            </>
          ) : (
            <>
              {labels.deleteConfirmMultipleText}{' '}
              <span className={styles.confirmItem}>
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
      confirmTextColor,
      confirmItemTextColor,
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
        />
      )}
    </Suspense>
  );
};
