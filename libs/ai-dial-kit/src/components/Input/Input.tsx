import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialInput } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import './Input.scss';

/** Props for the {@link Input} component. */
export type InputProps = ComponentPropsWithoutRef<typeof DialInput>;

/**
 * App-level text input wrapper around `DialInput`.
 *
 * Restyles the input's corner radius and resting border color to match the
 * rest of the app's rounded, lighter-bordered field language (e.g.
 * `SearchBar`, `libs/catalog`'s `border-tertiary` convention). `Input.scss`
 * also covers `DialTextarea`, which renders with the same `.dial-input`
 * class. All other behavior (label, error, validation states) is unchanged
 * from `DialInput`.
 *
 * @example
 * ```tsx
 * <Input id="name" value={name} onChange={setName} labelProps={{ label: 'Name' }} />
 * ```
 */
export const Input: FC<InputProps> = ({ className, ...props }) => (
  <DialInput {...props} className={mergeClasses('!rounded-xl', className)} />
);
