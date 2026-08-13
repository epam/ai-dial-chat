import { type FC } from 'react';
import { pickAvatarColor } from '../../utils/avatar-color';
import { buildCssVars } from '../../utils/build-css-vars';
import { extractInitials } from '../../utils/initials';
import { mergeClasses } from '../../utils/merge-class';
import styles from './InitialsAvatar.module.scss';

/** Props for `InitialsAvatar`. */
export interface InitialsAvatarProps {
  /** Display name from which initials are derived. Empty string renders `"?"`. */
  name: string;
  /** Badge width and height in pixels. */
  size: number;
  /** Extra classes applied to the root element (e.g. `'shrink-0'`). */
  className?: string;
  /** Extra classes applied to the initials text element (e.g. `'dial-h3-text'`). */
  textClassName?: string;
}

/** A square badge showing 1–2 initials derived from `name` on a deterministic colour background. */
export const InitialsAvatar: FC<InitialsAvatarProps> = ({
  name,
  size,
  className,
  textClassName = 'dial-h3-text',
}) => {
  const { background, foreground } = pickAvatarColor(name);
  const initials = extractInitials(name);
  const fontSize = Math.round(size * 0.4);

  const cssVars = buildCssVars({
    '--ia-bg': background,
    '--ia-fg': foreground,
  });

  return (
    <div
      aria-hidden="true"
      className={mergeClasses(
        'flex select-none items-center justify-center rounded-md',
        styles.badge,
        className,
      )}
      style={{ ...cssVars, width: size, height: size }}
    >
      <h3
        className={mergeClasses(styles.initials, textClassName)}
        style={{ fontSize }}
      >
        {initials}
      </h3>
    </div>
  );
};
