import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, GhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import styles from './Content.module.scss';

interface ContentTabProps {
  /** The item's full text body, rendered read-only with whitespace preserved. */
  content: string;
  /** Accessible label for the copy button. Defaults to `'Copy content'`. */
  copyAriaLabel?: string;
  /** Status text announced after a successful copy. Defaults to `'Copied'`. */
  copiedStatusLabel?: string;
  detailsStyles?: ItemDetailsStyles;
}

/** Renders a catalog item's long-form text body read-only, with a copy-to-clipboard control. */
export const ContentTab: FC<ContentTabProps> = ({
  content,
  copyAriaLabel = 'Copy content',
  copiedStatusLabel = 'Copied',
  detailsStyles,
}) => {
  const [copyStatus, setCopyStatus] = useState('');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus(copiedStatusLabel);
    } catch {
      /*
       * A denied clipboard permission is not actionable here: the body stays
       * selectable so the user can copy it manually. Announcing nothing is
       * preferable to announcing a success that did not happen.
       */
      setCopyStatus('');
    }
  }, [content, copiedStatusLabel]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <GhostIconButton
          icon={<IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />}
          aria-label={copyAriaLabel}
          onClick={handleCopy}
        />
      </div>
      <pre
        className={mergeClasses(
          'm-0 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words text-start',
          styles.content,
          detailsStyles?.typography?.contentClassName ?? 'dial-small-text',
        )}
      >
        {content}
      </pre>
      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus}
      </span>
    </div>
  );
};
