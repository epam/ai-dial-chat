import { ConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant, RadioGroup } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ButtonsI18nKeys } from '../../constants/translation-keys';
import { getPublishFolderLabel } from '../../utils/publish';

/** Props for `UnpublishConfirmationDialog`. */
interface Props {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Dialog title. */
  title: string;
  /** Name of the resource being unpublished, interpolated into the message. */
  name: string;
  /** Published folders as `/`-joined paths; `''` is the public root. */
  folders: string[];
  /** The picked folder when there are several; `null` until one is picked. */
  selectedFolder: string | null;
  /** Called with the folder the user picks. */
  onSelectedFolderChange: (folder: string) => void;
  /** Whether the unpublish request is running. */
  isLoading: boolean;
  /** Message for a single published folder. */
  confirmMessage: (name: string, folder: string) => string;
  /** Message asking the user to pick one of several folders. */
  selectFolderMessage: (name: string) => string;
  /** Accessible name of the folder radio group. */
  folderGroupAriaLabel: string;
  /** Status announced while the request runs. */
  loadingStatusLabel: string;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the dialog should close. */
  onClose: () => void;
}

/**
 * The unpublish confirmation shared by every unpublish surface in the app: one
 * published folder is confirmed directly, several require a pick first.
 * Cancel and Unpublish stay rendered and disabled while the request runs,
 * announcing progress through the footer's live region.
 */
const UnpublishConfirmationDialog: FC<Props> = ({
  isOpen,
  title,
  name,
  folders,
  selectedFolder,
  onSelectedFolderChange,
  isLoading,
  confirmMessage,
  selectFolderMessage,
  folderGroupAriaLabel,
  loadingStatusLabel,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const hasFolderChoice = folders.length > 1;

  return (
    <ConfirmationDialog
      open={isOpen}
      title={title}
      confirmLabel={t(ButtonsI18nKeys.Unpublish)}
      cancelLabel={t(ButtonsI18nKeys.Cancel)}
      variant={ConfirmationPopupVariant.Danger}
      isLoading={isLoading}
      isConfirmDisabled={hasFolderChoice && selectedFolder == null}
      loadingStatusLabel={loadingStatusLabel}
      message={
        <span className="wrap-break-word">
          {hasFolderChoice
            ? selectFolderMessage(name)
            : confirmMessage(name, getPublishFolderLabel(folders[0] ?? '', t))}
        </span>
      }
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {hasFolderChoice && (
        <RadioGroup
          className="mt-3"
          ariaLabel={folderGroupAriaLabel}
          value={selectedFolder ?? undefined}
          onChange={onSelectedFolderChange}
          disabled={isLoading}
          items={folders.map((folder) => ({
            value: folder,
            label: getPublishFolderLabel(folder, t),
          }))}
          radioClassName="dial-small-text text-primary"
        />
      )}
    </ConfirmationDialog>
  );
};

export default memo(UnpublishConfirmationDialog);
