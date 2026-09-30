import {
  buildCssVars,
  ConfirmationFooter,
  ConfirmationIdentityCard,
  ConfirmationView,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant, Popup } from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';
import styles from './ScheduledTaskDeleteConfirmation.module.scss';

/** Color overrides for `ScheduledTaskDeleteConfirmation`. */
export interface ScheduledTaskDeleteConfirmationColors {
  /** Type label above the task name. Defaults to `--text-secondary`. */
  typeLabelText?: string;
}

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

export interface ScheduledTaskDeleteConfirmationProps {
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
  consequences?: string[];
  cancelLabel: string;
  confirmLabel: string;
  /** Announced while the deletion is in flight. */
  pendingLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  styles?: ScheduledTaskDeleteConfirmationStyles;
}

/**
 * Controlled, host-localized delete-task confirmation. The dialog frame is the
 * kit's `Popup`; the content and the action row are the shared confirmation
 * components, so this reads the same as the catalog's in-panel confirmation.
 */
export const ScheduledTaskDeleteConfirmation: FC<
  ScheduledTaskDeleteConfirmationProps
> = ({
  open,
  taskName,
  icon,
  typeLabel,
  title,
  body,
  consequences,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  isDeleting = false,
  onConfirm,
  onClose,
  styles: stylesProp,
}) => {
  /* The footer's own controls are disabled while in flight; this also covers
   * the header's close control, Escape, and an outside click. */
  const close = () => {
    if (!isDeleting) onClose();
  };

  const cssVars = buildCssVars({
    '--stdc-type-label-text': stylesProp?.colors?.typeLabelText,
  });

  return (
    <Popup
      open={open}
      className={stylesProp?.popupClassName}
      titleClassName={stylesProp?.titleClassName}
      header={title}
      onClose={close}
      footer={
        <ConfirmationFooter
          variant={ConfirmationPopupVariant.Danger}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          isLoading={isDeleting}
          loadingStatusLabel={pendingLabel}
          onConfirm={onConfirm}
          onCancel={close}
        />
      }
    >
      <ConfirmationView
        variant={ConfirmationPopupVariant.Danger}
        identity={
          <ConfirmationIdentityCard variant={ConfirmationPopupVariant.Danger}>
            <div style={cssVars} className="flex min-w-0 items-center gap-2">
              {icon}
              <div className="flex min-w-0 flex-col">
                {typeLabel != null && (
                  <span
                    className={mergeClasses(
                      'dial-caption-lead-semi-text',
                      styles.typeLabel,
                    )}
                  >
                    {typeLabel}
                  </span>
                )}
                <span className="dial-small-semi-text truncate">
                  {taskName}
                </span>
              </div>
            </div>
          </ConfirmationIdentityCard>
        }
        message={body}
        consequences={consequences}
        messageClassName={
          stylesProp?.messageClassName ?? 'dial-body-paragraph-text'
        }
      />
    </Popup>
  );
};
