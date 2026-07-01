import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, MouseEvent } from 'react';
import styles from './StarToggleButton.module.scss';

/** Props for StarToggleButton. */
export interface StarToggleButtonProps {
  /** Whether the item is currently starred. */
  isStarred: boolean;
  /** Called when the button is clicked. */
  onClick: (e: MouseEvent<HTMLElement>) => void;
  /** Button size. Defaults to the ui-kit ghost icon button default. */
  size?: ElementSize;
  /** Accessible label for the button. Defaults to `'Toggle favorite'`. */
  ariaLabel?: string;
  /** Additional CSS classes forwarded to the button root element. */
  className?: string;
}

/** Ghost icon button that toggles between a filled and outline star. */
export const StarToggleButton: FC<StarToggleButtonProps> = ({
  isStarred,
  onClick,
  size,
  ariaLabel = 'Toggle favorite',
  className,
}) => (
  <DialGhostIconButton
    size={size}
    className={className}
    icon={
      isStarred ? (
        <IconStarFilled
          size={DIAL_ICON_SIZE.SM}
          className={styles.starFilledIcon}
        />
      ) : (
        <IconStar size={DIAL_ICON_SIZE.SM} />
      )
    }
    aria-label={ariaLabel}
    onClick={onClick}
  />
);
