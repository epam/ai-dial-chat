import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import styles from '../ConversationPanel.module.scss';

/** Props for `Header`. */
export interface HeaderProps {
  /** Panel heading text shown in the top bar. */
  title: string;
  /** Optional typography utility class applied to the title text. */
  titleClassName?: string;
  /**
   * When provided, a close (X) icon button is rendered on the end side and
   * is visible only on mobile screens. Clicking it calls this callback.
   */
  onToggle?: () => void;
  /** Accessible label for the close button (required when `onToggle` is provided). */
  closeAriaLabel?: string;
}

/** Top bar section containing the panel title. */
export const Header: FC<HeaderProps> = memo(
  ({ title, titleClassName, onToggle, closeAriaLabel }) => (
    <div
      className={mergeClasses(
        'flex h-12 shrink-0 items-center gap-2 border-b px-3',
        styles.header,
      )}
    >
      <span
        className={mergeClasses(
          'min-w-0 flex-1 truncate ps-2',
          styles.headerTitle,
          titleClassName,
        )}
      >
        {title}
      </span>

      {onToggle && (
        <DialGhostIconButton
          icon={<IconX size={DIAL_ICON_SIZE.MD} />}
          onClick={onToggle}
          className="hidden shrink-0 mobile:flex"
          aria-label={closeAriaLabel}
        />
      )}
    </div>
  ),
);
