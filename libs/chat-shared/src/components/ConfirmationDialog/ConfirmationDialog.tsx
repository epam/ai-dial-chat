import {
  ConfirmationPopupVariant,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { ConfirmationFooter } from '../ConfirmationView/ConfirmationFooter';
import {
  ConfirmationView,
  type ConfirmationViewProps,
} from '../ConfirmationView/ConfirmationView';

/** Props for `ConfirmationDialog`. */
export interface ConfirmationDialogProps extends ConfirmationViewProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Dialog title. A string rather than a node, so the kit names the dialog with it. */
  title: string;
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Label of the cancel button. */
  cancelLabel: string;
  /** Whether the confirmed action is in flight. While it is, both actions and every dismissal route are blocked. Default: `false`. */
  isLoading?: boolean;
  /** Whether confirming is not yet possible because the step's required input is unsatisfied. Default: `false`. */
  isConfirmDisabled?: boolean;
  /** Status text announced to assistive tech while the action is in flight. */
  loadingStatusLabel?: string;
  /**
   * Width cap of the dialog. Defaults to `PopupSize.Sm`, which is what a few
   * lines of copy and two buttons need — the kit's own `Popup` defaults to
   * `Md`, three times as wide.
   */
  size?: PopupSize;
  /** CSS class applied to the popup container, for example to constrain its width. */
  popupClassName?: string;
  /** CSS class applied to the dialog title. */
  titleClassName?: string;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed — Cancel, the header close control, Escape, or an outside click. */
  onClose: () => void;
}

/**
 * A confirmation step presented as a centered dialog: the same content block
 * and action row the catalog's details panel shows in place, inside the kit's
 * `Popup`. Use it wherever no details panel is open to host the step.
 */
export const ConfirmationDialog: FC<ConfirmationDialogProps> = ({
  open,
  title,
  confirmLabel,
  cancelLabel,
  isLoading = false,
  isConfirmDisabled = false,
  loadingStatusLabel,
  size = PopupSize.Sm,
  popupClassName,
  titleClassName,
  variant = ConfirmationPopupVariant.Info,
  onConfirm,
  onClose,
  ...viewProps
}) => {
  /*
   * Dismissing mid-request would leave the surface behind contradicting an
   * action that is still running, so every route out is gated, not just the
   * two buttons the footer disables.
   */
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
          variant={variant}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          isLoading={isLoading}
          isConfirmDisabled={isConfirmDisabled}
          loadingStatusLabel={loadingStatusLabel}
          onConfirm={onConfirm}
          onCancel={handleClose}
        />
      }
    >
      <ConfirmationView variant={variant} {...viewProps} />
    </Popup>
  );
};
