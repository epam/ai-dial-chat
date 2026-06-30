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
 * Gradient pill primary action button (`dial-primary-solid-button`).
 *
 * Visual style is applied by the app via `.dial-primary-solid-button` CSS overrides.
 *
 * @example
 * ```tsx
 * <PrimaryButton label="Send" onClick={handleSend} />
 * ```
 */
export const PrimaryButton: FC<PrimaryButtonProps> = (props) => (
  <DialPrimaryButton {...props} />
);

/** Props for the {@link SecondaryButton} component. `variant` and `appearance` are fixed. */
export type SecondaryButtonProps = Omit<
  DialButtonProps,
  'variant' | 'appearance'
>;

/**
 * Soft blue outlined pill secondary action button (`dial-neutral-outlined-button`).
 *
 * Visual style is applied by the app via `.dial-neutral-outlined-button` CSS overrides.
 *
 * @example
 * ```tsx
 * <SecondaryButton label="Cancel" onClick={handleCancel} />
 * ```
 */
export const SecondaryButton: FC<SecondaryButtonProps> = (props) => (
  <DialButton
    {...props}
    variant={ButtonVariant.Neutral}
    appearance={ButtonAppearance.Outlined}
  />
);

/** Props for the {@link GhostButton} component. */
export type GhostButtonProps = DialGhostButtonProps;

/**
 * Ghost pill tertiary action button with no border (`dial-primary-ghost-button`).
 *
 * Visual style is applied by the app via `.dial-primary-ghost-button` CSS overrides.
 *
 * @example
 * ```tsx
 * <GhostButton label="Learn more" onClick={handleLearnMore} />
 * ```
 */
export const GhostButton: FC<GhostButtonProps> = (props) => (
  <DialGhostButton {...props} />
);
