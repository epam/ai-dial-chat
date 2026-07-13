import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { GhostButton } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconLink, IconQrcode } from '@tabler/icons-react';
import { FC } from 'react';
import { SharePopoverView } from '../../types/share';
import styles from './SharePopover.module.scss';

/** DOM id of the QR-tab button, used to restore focus to it after leaving the QR view. */
export const QR_BUTTON_ID = 'share-popover-qr-button';
/** DOM id of the back-to-link button, used to restore focus to it after leaving the QR view. */
export const LINK_BUTTON_ID = 'share-popover-back-button';

/** Props for {@link SharePopoverHeader}. */
interface SharePopoverHeaderProps {
  /** Popover heading text. */
  title: string;
  /** Currently active body view. */
  view: SharePopoverView;
  /** QR-tab button label. */
  qrButtonLabel: string;
  /** Back-to-link button label. */
  linkLabel: string;
  /** Called with the view the user switched to. */
  onViewChange: (view: SharePopoverView) => void;
  /** CSS class applied to the title text. Defaults to `'dial-small-semi-text'`. */
  titleClassName?: string;
}

/** Popover title bar with the Link/QR view-toggle button. */
export const SharePopoverHeader: FC<SharePopoverHeaderProps> = ({
  title,
  view,
  qrButtonLabel,
  linkLabel,
  onViewChange,
  titleClassName = 'dial-small-semi-text',
}) => (
  <div className="flex items-center gap-2 px-4 py-3">
    <span className={mergeClasses(titleClassName, styles.title)}>{title}</span>
    {view === SharePopoverView.Link ? (
      <GhostButton
        id={QR_BUTTON_ID}
        label={qrButtonLabel}
        iconBefore={<IconQrcode size={DIAL_ICON_SIZE.SM} aria-hidden />}
        className="ms-auto"
        onClick={() => onViewChange(SharePopoverView.Qr)}
      />
    ) : (
      <GhostButton
        id={LINK_BUTTON_ID}
        label={linkLabel}
        iconBefore={<IconLink size={DIAL_ICON_SIZE.SM} aria-hidden />}
        className="ms-auto"
        onClick={() => onViewChange(SharePopoverView.Link)}
      />
    )}
  </div>
);
