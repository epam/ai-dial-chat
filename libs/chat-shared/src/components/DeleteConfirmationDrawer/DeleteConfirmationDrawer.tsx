import { ConfirmationPopupVariant, SideDrawer } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { ConfirmationFooter } from '../ConfirmationView/ConfirmationFooter';
import {
  DeleteConfirmationView,
  type DeleteConfirmationViewLabels,
  type DeleteConfirmationViewProps,
} from '../DeleteConfirmationView/DeleteConfirmationView';

/** User-visible strings of `DeleteConfirmationDrawer`. */
export interface DeleteConfirmationDrawerLabels extends DeleteConfirmationViewLabels {
  /** Label of the confirming action button. Defaults to `'Delete'`. */
  confirm?: string;
  /** Label of the cancel button. Defaults to `'Cancel'`. */
  cancel?: string;
  /** Status text announced while the deletion is in flight. Defaults to `'Deleting…'`. */
  deleting?: string;
  /** Accessible name of the header's close button. Defaults to `'Close'`. */
  close?: string;
}

/** Props for `DeleteConfirmationDrawer`. */
export interface DeleteConfirmationDrawerProps extends Omit<
  DeleteConfirmationViewProps,
  'labels'
> {
  /** Whether the drawer is open. */
  open: boolean;
  /** Drawer title. A string rather than a node, so the kit names the dialog with it. */
  title: string;
  /** Whether the delete request is in flight; blocks both actions and every dismissal route. Defaults to `false`. */
  isLoading?: boolean;
  /** User-visible strings. */
  labels?: DeleteConfirmationDrawerLabels;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the drawer is dismissed — Cancel, the close control, Escape, or a backdrop press. */
  onClose: () => void;
}

/** Delete confirmation presented as a side drawer, the same panel the catalog shows for an item. */
export const DeleteConfirmationDrawer: FC<DeleteConfirmationDrawerProps> = ({
  open,
  title,
  isLoading = false,
  labels,
  onConfirm,
  onClose,
  ...viewProps
}) => {
  const {
    confirm = 'Delete',
    cancel = 'Cancel',
    deleting = 'Deleting…',
    close = 'Close',
    ...viewLabels
  } = labels ?? {};

  // Dismissing mid-request would hide an action that is still running.
  const handleClose = () => {
    if (!isLoading) onClose();
  };

  return (
    <SideDrawer
      open={open}
      header={title}
      closeAriaLabel={close}
      closeDisabled={isLoading}
      closeOnOutsideClick={!isLoading}
      onClose={handleClose}
      bodyClassName="flex flex-col overflow-hidden"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <DeleteConfirmationView {...viewProps} labels={viewLabels} />
      </div>
      <ConfirmationFooter
        variant={ConfirmationPopupVariant.Danger}
        confirmLabel={confirm}
        cancelLabel={cancel}
        isLoading={isLoading}
        loadingStatusLabel={deleting}
        onConfirm={onConfirm}
        onCancel={handleClose}
      />
    </SideDrawer>
  );
};
