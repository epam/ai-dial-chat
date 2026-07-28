import { DialTextarea } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import '../Input/Input.scss';

/** Props for the {@link Textarea} component. */
export type TextareaProps = ComponentPropsWithoutRef<typeof DialTextarea>;

/**
 * App-level textarea wrapper around `DialTextarea`.
 *
 * @example
 * ```tsx
 * <Textarea id="description" value={description} onChange={setDescription} />
 * ```
 */
export const Textarea: FC<TextareaProps> = (props) => (
  <DialTextarea {...props} />
);
