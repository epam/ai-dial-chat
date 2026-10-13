import {
  ConfirmationPopupVariant,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { ConfirmationFooter } from '../ConfirmationView/ConfirmationFooter';
import {
  DeleteConfirmationView,
  type DeleteConfirmationViewLabels,
  type DeleteConfirmationViewProps,
} from '../DeleteConfirmationView/DeleteConfirmationView';

/** User-visible strings of `DeleteConfirmationDialog`. */
export interface DeleteConfirmationDialogLabels extends DeleteConfirmationViewLabels {
  /** Label of the confirming action button. Defaults to `'Delete'`. */
  confirm?: string;
  /** Label of the cancel button. Defaults to `'Cancel'`. */
  cancel?: string;
  /** Status text announced while the deletion is in flight. Defaults to `'Deleting…'`. */
  deleting?: string;
}

/** Style overrides for `DeleteConfirmationDialog`. */
export interface DeleteConfirmationDialogStyles extends NonNullable<
  DeleteConfirmationViewProps['styles']
> {
  /** CSS class applied to the popup container. */
  popupClassName?: string;
  /** CSS class applied to the dialog title. */
  titleClassName?: string;
}

/** Props for `DeleteConfirmationDialog`. */
export interface DeleteConfirmationDialogProps extends Omit<
  DeleteConfirmationViewProps,
  'labels' | 'styles'
> {
  /** Whether the dialog is open. */
  open: boolean;
  /** Dialog title. A string rather than a node, so the kit names the dialog with it. */
  title: string;
  /** Whether the delete request is in flight; blocks both actions and every dismissal route. Defaults to `false`. */
  isLoading?: boolean;
  /** Width cap of the dialog. Defaults to `PopupSize.Sm`. */
  size?: PopupSize;
  /** User-visible strings. */
  labels?: DeleteConfirmationDialogLabels;
  /** Style overrides. */
  styles?: DeleteConfirmationDialogStyles;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed — Cancel, the close control, Escape, or an outside click. */
  onClose: () => void;
}

/** Delete confirmation presented as a centered dialog, for one resource or a selection. */
export const DeleteConfirmationDialog: FC<DeleteConfirmationDialogProps> = ({
  open,
  title,
  isLoading = false,
  size = PopupSize.Sm,
  labels,
  styles: stylesProp,
  onConfirm,
  onClose,
  ...viewProps
}) => {
  const {
    confirm = 'Delete',
    cancel = 'Cancel',
    deleting = 'Deleting…',
    ...viewLabels
  } = labels ?? {};
  const { popupClassName, titleClassName, ...viewStyles } = stylesProp ?? {};

  // Dismissing mid-request would hide an action that is still running.
  const handleClose = () => {
    if (!isLoading) onClose();
  };

  return (
    <Popup
      open={open}
      header={title}
      size={size}
      className={popupClassName}
      titleClassName={titleClassName}
      onClose={handleClose}
      footer={
        <ConfirmationFooter
          variant={ConfirmationPopupVariant.Danger}
          confirmLabel={confirm}
          cancelLabel={cancel}
          isLoading={isLoading}
          loadingStatusLabel={deleting}
          onConfirm={onConfirm}
          onCancel={handleClose}
        />
      }
    >
      <DeleteConfirmationView
        {...viewProps}
        labels={viewLabels}
        styles={viewStyles}
      />
    </Popup>
  );
};
