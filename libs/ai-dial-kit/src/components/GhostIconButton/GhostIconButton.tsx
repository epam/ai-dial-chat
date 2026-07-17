import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';

type DialGhostIconButtonProps = ComponentPropsWithoutRef<
  typeof DialGhostIconButton
>;

/** Color overrides for the {@link GhostIconButton} component. */
export interface GhostIconButtonColors {
  /** Class applied when `isActive` is `true`. Defaults to `'!bg-layer-0 !text-accent-primary shadow-sm'`. */
  activeClassName?: string;
  /** Class applied when `isActive` is `false` or omitted. Defaults to `'!text-secondary'`. */
  inactiveClassName?: string;
}

/** Style overrides for the {@link GhostIconButton} component. */
export interface GhostIconButtonStyles {
  /** Color overrides applied via the active/inactive class swap. */
  colors?: GhostIconButtonColors;
}

/** Props for the {@link GhostIconButton} component. */
export interface GhostIconButtonProps extends DialGhostIconButtonProps {
  /** Whether the button is in an active/selected state. Applies `styles.colors.activeClassName` when true. */
  isActive?: boolean;
  /** Style overrides for the active/inactive state. */
  styles?: GhostIconButtonStyles;
}

/** Ghost icon button with active/inactive state toggle via className swap. */
export const GhostIconButton: FC<GhostIconButtonProps> = ({
  isActive,
  styles,
  className,
  ...rest
}) => {
  const {
    activeClassName = '!bg-layer-0 !text-accent-primary shadow-sm',
    inactiveClassName = '!text-secondary',
  } = styles?.colors ?? {};

  return (
    <DialGhostIconButton
      className={mergeClasses(
        'rounded-[6px]',
        isActive ? activeClassName : inactiveClassName,
        className,
      )}
      {...rest}
    />
  );
};
