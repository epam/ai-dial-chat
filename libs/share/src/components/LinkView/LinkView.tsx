import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, GhostIconButton, Input } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { FC } from 'react';
import styles from '../SharePopover/SharePopover.module.scss';

/** Props for {@link LinkView}. */
interface LinkViewProps {
  /** The share URL shown in the read-only input. */
  url: string;
  /** `aria-label` for the URL input. */
  linkAriaLabel: string;
  /** Whether the URL was just copied to the clipboard. */
  isCopied: boolean;
  /** Copy button default label, used for its `aria-label`/tooltip. */
  copyButtonLabel: string;
  /** Copy button label after copying, used for its `aria-label`/tooltip. */
  copiedButtonLabel: string;
  /** Called when the Copy button is clicked. */
  onCopy: () => void;
}

/** Pill-shaped read-only URL field with an icon-only copy-to-clipboard button. */
export const LinkView: FC<LinkViewProps> = ({
  url,
  linkAriaLabel,
  isCopied,
  copyButtonLabel,
  copiedButtonLabel,
  onCopy,
}) => (
  <>
    <div
      className={mergeClasses(
        'flex items-center gap-3 rounded-full px-4 py-2',
        styles.linkRow,
      )}
    >
      <Input
        readOnly
        value={url}
        aria-label={linkAriaLabel}
        containerClassName="min-w-0 flex-1"
        wrapperClassName="border-0 bg-transparent px-0 outline-none"
      />
      <GhostIconButton
        icon={
          isCopied ? (
            <IconCheck size={DIAL_ICON_SIZE.LG} aria-hidden />
          ) : (
            <IconCopy size={DIAL_ICON_SIZE.LG} aria-hidden />
          )
        }
        aria-label={isCopied ? copiedButtonLabel : copyButtonLabel}
        tooltipProps={{
          tooltip: isCopied ? copiedButtonLabel : copyButtonLabel,
        }}
        onClick={onCopy}
      />
    </div>
    {/* Screen-reader-only announcement: button label change is visual-only. */}
    <span role="status" aria-live="polite" className="sr-only">
      {isCopied ? copiedButtonLabel : ''}
    </span>
  </>
);
