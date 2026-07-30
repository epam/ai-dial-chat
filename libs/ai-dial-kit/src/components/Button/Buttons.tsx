import { DialGhostButton } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import './Buttons.scss';

type DialGhostButtonProps = ComponentPropsWithoutRef<typeof DialGhostButton>;

/** Props for the {@link GhostButton} component. */
export type GhostButtonProps = DialGhostButtonProps;

/**
 * Ghost pill tertiary action button with no border.
 *
 * @example
 * ```tsx
 * <GhostButton label="Learn more" onClick={handleLearnMore} />
 * ```
 */
export const GhostButton: FC<GhostButtonProps> = (props) => (
  <DialGhostButton {...props} />
);
