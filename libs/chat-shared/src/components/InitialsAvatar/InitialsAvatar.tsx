import { Avatar, AvatarShape } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';

/** Props for `InitialsAvatar`. */
export interface InitialsAvatarProps {
  /** Display name from which initials are derived. Empty string renders `"?"`. */
  name: string;
  /** Badge width and height in pixels. */
  size: number;
  /** Extra classes applied to the root element (e.g. `'shrink-0'`). */
  className?: string;
  /** Type-scale class for the initials. Defaults to none: the initials are semibold at 40% of `size`. */
  textClassName?: string;
}

/** A square badge showing 1–2 initials derived from `name` on a deterministic colour background. */
export const InitialsAvatar: FC<InitialsAvatarProps> = ({
  name,
  size,
  className,
  textClassName,
}) => (
  /* Decorative: the entity it stands for is always named beside it. */
  <Avatar
    name={name}
    size={size}
    shape={AvatarShape.Square}
    className={className}
    textClassName={textClassName}
  />
);
