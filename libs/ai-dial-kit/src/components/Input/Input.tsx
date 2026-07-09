import { DialInput } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import './Input.scss';

/** Props for the {@link Input} component. */
export type InputProps = ComponentPropsWithoutRef<typeof DialInput>;

/**
 * App-level text input wrapper around `DialInput`.
 *
 * `Input.scss` restyles the field's corner radius and border colors (resting,
 * hover, and focus) to match the app's rounded field language (e.g.
 * `SearchBar`) via a global `.dial-input` class override, since `DialInput`
 * renders its visible bordered box as a wrapper `<div>` around a borderless
 * `<input>` — passing `className` (which lands on that inner, `overflow:
 * hidden`-truncated input) would not restyle the real border, and would clip
 * text/cursor near the corners if a radius were forced onto it. `Input.scss`
 * also covers `DialTextarea`, which renders with the same `.dial-input`
 * class directly on the `<textarea>`. All other behavior (label, error,
 * validation states) is unchanged from `DialInput`.
 *
 * @example
 * ```tsx
 * <Input id="name" value={name} onChange={setName} labelProps={{ label: 'Name' }} />
 * ```
 */
export const Input: FC<InputProps> = (props) => <DialInput {...props} />;
