import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Avatar } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import styles from './MenuPrimitives.module.scss';

/** Props for `AvatarInitials`. */
export interface AvatarInitialsProps {
  /** One-or-two-letter initials; renders an empty badge when omitted. */
  shortName?: string;
  /** Extra class name(s) merged onto the badge. */
  className?: string;
  /** CSS class controlling the initials' type scale. Defaults to `'dial-tiny-text'`. */
  textClassName?: string;
}

/** Circular 28 px badge showing a signed-in user's initials. */
export const AvatarInitials: FC<AvatarInitialsProps> = memo(
  ({ shortName, className, textClassName = 'dial-tiny-text' }) => (
    <Avatar
      name={shortName ?? ''}
      initials={shortName ?? ''}
      size={28}
      textClassName={textClassName}
      className={mergeClasses(styles.avatar, className)}
    />
  ),
);
