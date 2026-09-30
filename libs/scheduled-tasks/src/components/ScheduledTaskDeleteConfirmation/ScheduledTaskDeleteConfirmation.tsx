import {
  ConfirmationDialog,
  ConfirmationIdentityCard,
  ConfirmationIdentityRow,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';

/** Color overrides for `ScheduledTaskDeleteConfirmation`. */
export interface ScheduledTaskDeleteConfirmationColors {
  /** Type label above the task name. Defaults to `--text-secondary`. */
  typeLabelText?: string;
}

/** Style overrides for `ScheduledTaskDeleteConfirmation`. */
export interface ScheduledTaskDeleteConfirmationStyles {
  /** CSS class applied to the popup container, for example to constrain its width. */
  popupClassName?: string;
  /** CSS class applied to the dialog title. */
  titleClassName?: string;
  /** Typography class applied to the warning sentence and the consequence bullets. Defaults to `'dial-body-paragraph-text'`. */
  messageClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: ScheduledTaskDeleteConfirmationColors;
}

/** Props for `ScheduledTaskDeleteConfirmation`. */
export interface ScheduledTaskDeleteConfirmationProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Task name, echoed in the identity card so the user sees exactly which task will go. */
  taskName: string;
  /**
   * Icon rendered in the identity card ahead of the task's type and name.
   * Supplied by the host, which owns the glyph set. Omitted renders the card
   * without one.
   */
  icon?: ReactNode;
  /** Resource type shown above the name. Pass it in sentence case — the label uppercases itself. */
  typeLabel?: string;
  /** Dialog title. A string rather than a node, so the kit names the dialog with it. */
  title: string;
  /** Warning sentence, which the host composes so it can emphasise the task name. */
  body: ReactNode;
  /** Consequences listed as bullets under the warning. The last one states that the action cannot be undone. */
  consequences?: string[];
  /** Label of the cancel button. */
  cancelLabel: string;
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Announced while the deletion is in flight. */
  pendingLabel?: string;
  /** Whether the delete request is in flight; blocks both actions and every dismissal route. Default: `false`. */
  isDeleting?: boolean;
  /** Called when the user confirms deletion. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed — Cancel, the close control, Escape, or an outside click. */
  onClose: () => void;
  /** Style overrides. */
  styles?: ScheduledTaskDeleteConfirmationStyles;
}

/**
 * Controlled, host-localized delete-task confirmation: the shared confirmation
 * dialog, with the task's identity card composed from the icon and type label
 * the host supplies.
 */
export const ScheduledTaskDeleteConfirmation: FC<
  ScheduledTaskDeleteConfirmationProps
> = ({
  taskName,
  icon,
  typeLabel,
  body,
  pendingLabel,
  isDeleting = false,
  styles: stylesProp,
  ...dialogProps
}) => (
  <ConfirmationDialog
    {...dialogProps}
    variant={ConfirmationPopupVariant.Danger}
    popupClassName={stylesProp?.popupClassName}
    titleClassName={stylesProp?.titleClassName}
    messageClassName={
      stylesProp?.messageClassName ?? 'dial-body-paragraph-text'
    }
    message={body}
    isLoading={isDeleting}
    loadingStatusLabel={pendingLabel}
    identity={
      <ConfirmationIdentityCard variant={ConfirmationPopupVariant.Danger}>
        <ConfirmationIdentityRow
          icon={icon}
          typeLabel={typeLabel}
          name={taskName}
          styles={{ colors: stylesProp?.colors }}
        />
      </ConfirmationIdentityCard>
    }
  />
);
