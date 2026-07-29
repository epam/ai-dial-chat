import { DialInput } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import './Input.scss';

/** Props for the {@link Input} component. */
export type InputProps = ComponentPropsWithoutRef<typeof DialInput>;

/**
 * App-level text input wrapper around `DialInput`.
 *
 * @example
 * ```tsx
 * <Input id="name" value={name} onChange={setName} labelProps={{ label: 'Name' }} />
 * ```
 */
export const Input: FC<InputProps> = (props) => <DialInput {...props} />;
