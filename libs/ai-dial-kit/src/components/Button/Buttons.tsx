import {
  ButtonAppearance,
  ButtonVariant,
  DialButton,
  DialGhostButton,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import './Buttons.scss';

type DialPrimaryButtonProps = ComponentPropsWithoutRef<
  typeof DialPrimaryButton
>;
type DialGhostButtonProps = ComponentPropsWithoutRef<typeof DialGhostButton>;
type DialButtonProps = ComponentPropsWithoutRef<typeof DialButton>;

/** Props for the {@link PrimaryButton} component. */
export type PrimaryButtonProps = DialPrimaryButtonProps;

/**
 * Gradient pill primary action button.
 *
 * @example
 * ```tsx
 * <PrimaryButton label="Send" onClick={handleSend} />
 * ```
 */
export const PrimaryButton: FC<PrimaryButtonProps> = (props) => (
  <DialPrimaryButton {...props} />
);

/** Props for the {@link NeutralButton} component. `variant` and `appearance` are fixed. */
export type NeutralButtonProps = Omit<
  DialButtonProps,
  'variant' | 'appearance'
>;

/**
 * Soft blue outlined pill neutral action button.
 *
 * @example
 * ```tsx
 * <NeutralButton label="Cancel" onClick={handleCancel} />
 * ```
 */
export const NeutralButton: FC<NeutralButtonProps> = (props) => (
  <DialButton
    {...props}
    variant={ButtonVariant.Neutral}
    appearance={ButtonAppearance.Outlined}
  />
);

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
