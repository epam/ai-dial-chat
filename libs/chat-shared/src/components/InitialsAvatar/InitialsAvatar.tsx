import { type FC } from 'react';
import { pickAvatarColor } from '../../utils/avatar-color';
import { extractInitials } from '../../utils/initials';
import { mergeClasses } from '../../utils/merge-class';

/** Props for `InitialsAvatar`. */
export interface InitialsAvatarProps {
  /** Display name from which initials are derived. Empty string renders `"?"`. */
  name: string;
  /** Badge width and height in pixels. */
  size: number;
  /** Extra classes applied to the root element (e.g. `'shrink-0'`). */
  className?: string;
  /**
   * Typography class applied to the initials. Defaults to `'dial-h3-text'`.
   * Only its weight, line-height, and tracking take effect — `font-size` is
   * computed from `size` and set inline, so it wins over the class.
   */
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

  return (
    <div
      aria-hidden="true"
      className={mergeClasses(
        'flex select-none items-center justify-center rounded-md',
        className,
      )}
      style={{ width: size, height: size, backgroundColor: background }}
    >
      <h3 className={textClassName} style={{ fontSize, color: foreground }}>
        {initials}
      </h3>
    </div>
  );
};
