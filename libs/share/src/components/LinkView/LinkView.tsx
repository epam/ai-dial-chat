import { CopyButton, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Input } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import styles from '../SharePopover/SharePopover.module.scss';

/** Props for {@link LinkView}. */
interface LinkViewProps {
  /** The share URL shown in the read-only input. */
  url: string;
  /** Label above the URL field. */
  linkLabel: string;
  /** `aria-label` for the URL input. */
  linkAriaLabel: string;
  /** Whether the URL was just copied to the clipboard. */
  isCopied: boolean;
  /** Copy button default label. */
  copyButtonLabel: string;
  /** Copy button label after copying. */
  copiedButtonLabel: string;
  /** Called when the Copy button is clicked. */
  onCopy: () => void;
  /** CSS class applied to the section label above the URL field. Defaults to `'dial-tiny-semi-text uppercase'`. */
  sectionLabelClassName?: string;
}

/** Read-only URL field with a copy-to-clipboard button. */
export const LinkView: FC<LinkViewProps> = ({
  url,
  linkLabel,
  linkAriaLabel,
  isCopied,
  copyButtonLabel,
  copiedButtonLabel,
  onCopy,
  sectionLabelClassName = 'dial-tiny-semi-text uppercase',
}) => (
  <>
    <p
      className={mergeClasses(
        sectionLabelClassName,
        'mt-3',
        styles.sectionLabel,
      )}
    >
      {linkLabel}
    </p>
    <div
      className={mergeClasses('flex items-center gap-2', styles.sectionLabel)}
    >
      <Input
        readOnly
        value={url}
        aria-label={linkAriaLabel}
        containerClassName="min-w-0 flex-1"
      />
      <CopyButton
        copiedLabel={copiedButtonLabel}
        copyLabel={copyButtonLabel}
        isCopied={isCopied}
        onClick={onCopy}
      />
    </div>
    {/* Screen-reader-only announcement: button label change is visual-only. */}
    <span role="status" aria-live="polite" className="sr-only">
      {isCopied ? copiedButtonLabel : ''}
    </span>
  </>
);
