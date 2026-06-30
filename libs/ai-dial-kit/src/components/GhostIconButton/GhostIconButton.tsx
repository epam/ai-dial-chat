import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';

type DialGhostIconButtonProps = ComponentPropsWithoutRef<
  typeof DialGhostIconButton
>;

/** Props for the {@link GhostIconButton} component. */
export interface GhostIconButtonProps extends DialGhostIconButtonProps {
  /** Whether the button is in an active/selected state. Applies `activeClassName` when true. */
  isActive?: boolean;
  /** Class applied when `isActive` is `true`. Defaults to `'!bg-layer-0 !text-accent-primary shadow-sm'`. */
  activeClassName?: string;
  /** Class applied when `isActive` is `false` or omitted. Defaults to `'!text-secondary'`. */
  inactiveClassName?: string;
}

/** Ghost icon button with active/inactive state toggle via className swap. */
export const GhostIconButton: FC<GhostIconButtonProps> = ({
  isActive,
  activeClassName = '!bg-layer-0 !text-accent-primary shadow-sm',
  inactiveClassName = '!text-secondary',
  className,
  ...rest
}) => (
  <DialGhostIconButton
    className={mergeClasses(
      'rounded-[6px]',
      isActive ? activeClassName : inactiveClassName,
      className,
    )}
    {...rest}
  />
);
