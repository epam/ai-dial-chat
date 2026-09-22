import { ButtonAppearance, ButtonVariant, Popup } from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';

export interface ScheduledTaskDeleteConfirmationStyles {
  titleClassName?: string;
  actionClassName?: string;
}

export interface ScheduledTaskDeleteConfirmationProps {
  open: boolean;
  taskName: string;
  title: ReactNode;
  body: ReactNode;
  consequences?: ReactNode[];
  cancelLabel: string;
  /** Cancel button appearance. Defaults to Ghost. */
  cancelAppearance?: ButtonAppearance;
  confirmLabel: string;
  pendingLabel?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  styles?: ScheduledTaskDeleteConfirmationStyles;
}

/** Controlled, host-localized delete-confirmation presentation. */
export const ScheduledTaskDeleteConfirmation: FC<
  ScheduledTaskDeleteConfirmationProps
> = ({
  open,
  taskName,
  title,
  body,
  consequences = [],
  cancelLabel,
  cancelAppearance = ButtonAppearance.Ghost,
  confirmLabel,
  pendingLabel,
  isDeleting = false,
  onConfirm,
  onClose,
  styles,
}) => {
  const close = () => {
    if (!isDeleting) onClose();
  };
  const confirm = () => {
    if (!isDeleting) onConfirm();
  };

  return (
    <Popup
      open={open}
      header={<span className={styles?.titleClassName}>{title}</span>}
      onClose={close}
      mainButtons={[
        {
          label: cancelLabel,
          onClick: close,
          disabled: isDeleting,
          appearance: cancelAppearance,
        },
        {
          label: isDeleting ? (pendingLabel ?? confirmLabel) : confirmLabel,
          onClick: confirm,
          disabled: isDeleting,
          variant: ButtonVariant.Danger,
          className: styles?.actionClassName,
        },
      ]}
    >
      <div className="flex flex-col gap-4 px-6 pb-4 pt-2">
        <div className="flex h-11 items-center rounded-lg border border-error-alpha bg-error px-3">
          <span className="dial-small-semi-text truncate">{taskName}</span>
        </div>
        <div className="dial-body-paragraph-text break-words">{body}</div>
        {consequences.length > 0 && (
          <ul className="flex flex-col gap-2 ps-[18px]">
            {consequences.map((consequence, index) => (
              <li
                key={index}
                className="dial-body-paragraph-text list-disc text-secondary marker:text-secondary"
              >
                {consequence}
              </li>
            ))}
          </ul>
        )}
        {isDeleting && (
          <span role="status" aria-live="polite" className="sr-only">
            {pendingLabel ?? confirmLabel}
          </span>
        )}
      </div>
    </Popup>
  );
};
