import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DangerButton,
  DIAL_ICON_SIZE,
  GhostButton,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconTrashX } from '@tabler/icons-react';
import { FC } from 'react';
import { DetailsConfirmationVariant } from '../../../types/details-confirmation';
import styles from './ConfirmationView.module.scss';

/** Props for `ConfirmationFooter`. */
export interface ConfirmationFooterProps {
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Label of the cancel button. */
  cancelLabel: string;
  /** Palette of the confirm button; `Danger` also gives it a leading trash icon. Default: `DetailsConfirmationVariant.Info`. */
  variant?: DetailsConfirmationVariant;
  /** Whether the confirmed action is in flight. Default: `false`. */
  isLoading?: boolean;
  /** Status text announced to assistive tech while the action is in flight. */
  loadingStatusLabel?: string;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/** Action row pinned to the bottom of the details panel while a confirmation step is open. */
export const ConfirmationFooter: FC<ConfirmationFooterProps> = ({
  confirmLabel,
  cancelLabel,
  variant = DetailsConfirmationVariant.Info,
  isLoading = false,
  loadingStatusLabel,
  onConfirm,
  onCancel,
}) => {
  const isDanger = variant === DetailsConfirmationVariant.Danger;

  const iconBefore = (() => {
    if (isLoading) {
      return <Spinner size={DIAL_ICON_SIZE.SM} />;
    }
    if (isDanger) {
      return <IconTrashX size={DIAL_ICON_SIZE.MD} aria-hidden />;
    }
    return undefined;
  })();

  const ConfirmButton = isDanger ? DangerButton : NeutralButton;

  return (
    <div
      className={mergeClasses(
        'flex items-center justify-end gap-2 px-6 py-4 rtl:flex-row-reverse rtl:justify-start',
        styles.footer,
      )}
    >
      <GhostButton
        label={cancelLabel}
        disabled={isLoading}
        onClick={onCancel}
      />
      <ConfirmButton
        label={confirmLabel}
        disabled={isLoading}
        iconBefore={iconBefore}
        onClick={onConfirm}
      />
      {isLoading && loadingStatusLabel != null && (
        <span role="status" aria-live="polite" className="sr-only">
          {loadingStatusLabel}
        </span>
      )}
    </div>
  );
};
