import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { IconCaretDownFilled, IconCaretRightFilled } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from '../ConversationPanel/ConversationPanel.module.scss';

/** Props for `ConversationGroupHeader`. */
export interface ConversationGroupHeaderProps {
  /** Section heading label. */
  label: string;
  /** Whether the group is currently expanded. */
  isExpanded: boolean;
  /** Called when the user clicks the header to toggle expansion. */
  onToggle: () => void;
  /** Typography class applied to the header button. Defaults to `'dial-tiny-text'`. */
  className?: string;
}

/** Collapsible group header button used in the virtualised conversation list. */
export const ConversationGroupHeader: FC<ConversationGroupHeaderProps> = ({
  label,
  isExpanded,
  onToggle,
  className = 'dial-tiny-text',
}) => (
  <button
    type="button"
    aria-expanded={isExpanded}
    onClick={onToggle}
    className={mergeClasses(
      'flex h-6 w-full items-center gap-1 rounded py-1 pe-3 text-start',
      className,
      styles.groupHeader,
    )}
  >
    {isExpanded ? (
      <IconCaretDownFilled stroke={0.5} size={12} className="shrink-0" />
    ) : (
      <IconCaretRightFilled stroke={0.5} size={12} className="shrink-0" />
    )}
    <DialEllipsisTooltip text={label} />
  </button>
);
