import {
  buildCssVars,
  ConfirmationDialog,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant, RadioGroup } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { UnpublishConfirmationDialogProps } from '../../models/unpublish-confirmation-dialog';
import { getFolderDisplayName } from '../../utils/publish-folder-tree';
import styles from './UnpublishConfirmationDialog.module.scss';

const defaultConfirmMessage = (name: string, folder: string): string =>
  `Unpublish "${name}" from "${folder}"?`;

const defaultSelectFolderMessage = (name: string): string =>
  `Choose which folder to unpublish "${name}" from.`;

/**
 * Confirms an unpublish request: one published folder is confirmed directly,
 * several require a pick first. Cancel and Unpublish stay rendered and
 * disabled while the request runs, announcing progress through the footer's
 * live region.
 */
export const UnpublishConfirmationDialog: FC<
  UnpublishConfirmationDialogProps
> = ({
  isOpen,
  name,
  folders,
  selectedFolder,
  onSelectedFolderChange,
  isLoading = false,
  labels,
  optionClassName = 'dial-small-text',
  colors,
  onConfirm,
  onClose,
}) => {
  const {
    title = 'Unpublish?',
    confirmLabel = 'Unpublish',
    cancelLabel = 'Cancel',
    rootFolderLabel = 'Organization',
    folderGroupAriaLabel = 'Published folders',
    loadingStatusLabel = 'Requesting unpublish…',
    confirmMessage = defaultConfirmMessage,
    selectFolderMessage = defaultSelectFolderMessage,
  } = labels ?? {};
  const hasFolderChoice = folders.length > 1;

  return (
    <ConfirmationDialog
      open={isOpen}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={ConfirmationPopupVariant.Danger}
      isLoading={isLoading}
      isConfirmDisabled={hasFolderChoice && selectedFolder == null}
      loadingStatusLabel={loadingStatusLabel}
      message={
        <span className="wrap-break-word">
          {hasFolderChoice
            ? selectFolderMessage(name)
            : confirmMessage(
                name,
                getFolderDisplayName(folders[0] ?? '', rootFolderLabel),
              )}
        </span>
      }
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {hasFolderChoice && (
        <div
          className="mt-3"
          style={buildCssVars({ '--ucd-option-text': colors?.optionText })}
        >
          <RadioGroup
            ariaLabel={folderGroupAriaLabel}
            value={selectedFolder ?? undefined}
            onChange={onSelectedFolderChange}
            disabled={isLoading}
            items={folders.map((folder) => ({
              value: folder,
              label: getFolderDisplayName(folder, rootFolderLabel),
            }))}
            radioClassName={mergeClasses(optionClassName, styles.option)}
          />
        </div>
      )}
    </ConfirmationDialog>
  );
};
