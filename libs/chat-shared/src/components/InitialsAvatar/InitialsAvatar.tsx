import {
  Avatar,
  AvatarShape,
  type AvatarColorClasses,
} from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';

/** Props for `InitialsAvatar`. */
export interface InitialsAvatarProps {
  /** Display name from which initials are derived. Empty string renders `"?"`. */
  name: string;
  /** Badge width and height in pixels. */
  size: number;
  /** Explicit colour pair overriding the deterministic pick from `name` (an `AVATAR_PALETTE` entry); omit to keep the name-derived colour. */
  color?: AvatarColorClasses;
  /** Extra classes applied to the root element (e.g. `'shrink-0'`). */
  className?: string;
  /** Type-scale class for the initials. Defaults to none: the initials are semibold at 40% of `size`. */
  textClassName?: string;
}

/** A square badge showing 1–2 initials derived from `name` on a deterministic colour background. */
export const InitialsAvatar: FC<InitialsAvatarProps> = ({
  name,
  size,
  color,
  className,
  textClassName,
}) => (
  /* Decorative: the entity it stands for is always named beside it. */
  <Avatar
    name={name}
    size={size}
    shape={AvatarShape.Square}
    color={color}
    className={className}
    textClassName={textClassName}
  />
);
