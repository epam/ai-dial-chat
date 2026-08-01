import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  ElementSize,
  StaticIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconDownload,
  IconExternalLink,
  IconReload,
  IconX,
} from '@tabler/icons-react';
import { ReactNode, type FC, type MouseEvent } from 'react';
import styles from './Attachment.module.scss';

interface ActionProps {
  /** Icon to render inside the button. */
  icon: ReactNode;
  /** Optional additional class name for the button. */
  className?: string;
  /** Localised accessible label for the retry button. */
  ariaLabel?: string;
  /** Localised accessible title for the error state. */
  errorTitle?: string;
  /** ID of the element that describes the error state. */
  errorDescId?: string;
  /** Called when the user clicks the retry button. */
  onClick: (id: string) => void;
  /** ID of the attachment to retry. */
  id?: string;
}

/** Action button for completed uploads. */
export const ActionButton: FC<ActionProps> = ({
  ariaLabel,
  errorTitle,
  errorDescId,
  onClick,
  id,
  icon,
  className,
}) => {
  return (
    <StaticIconButton
      icon={icon}
      size={ElementSize.Small}
      className={mergeClasses(
        'absolute end-1 top-1 opacity-0 focus-visible:opacity-100 group-focus-within/attachment-tile:opacity-100 group-hover/attachment-tile:opacity-100',
        className,
      )}
      aria-label={ariaLabel}
      aria-describedby={errorTitle ? errorDescId : undefined}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick(id as string);
      }}
    />
  );
};

/** Retry button for failed uploads. */
export const ReloadAction: FC<Omit<ActionProps, 'icon'>> = ({ ...props }) => {
  return (
    <ActionButton
      icon={<IconReload size={DIAL_ICON_SIZE.SM} aria-hidden />}
      className={styles.retryIcon}
      {...props}
    />
  );
};

/** Download button for completed uploads. */
export const DownloadAction: FC<Omit<ActionProps, 'icon'>> = ({ ...props }) => {
  return (
    <ActionButton
      icon={<IconDownload size={DIAL_ICON_SIZE.SM} aria-hidden />}
      {...props}
    />
  );
};

/** Open-in-new-tab button for link attachments. */
export const OpenLinkAction: FC<Omit<ActionProps, 'icon'>> = ({ ...props }) => {
  return (
    <ActionButton
      icon={<IconExternalLink size={DIAL_ICON_SIZE.SM} aria-hidden />}
      {...props}
    />
  );
};

/** Remove button for attachments. */
export const RemoveAction: FC<Omit<ActionProps, 'icon'>> = ({ ...props }) => {
  return (
    <ActionButton
      icon={<IconX size={DIAL_ICON_SIZE.SM} aria-hidden />}
      className={styles.hoverIcon}
      {...props}
    />
  );
};
