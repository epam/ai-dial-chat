import { DialTextarea } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import '../Input/Input.scss';

/** Props for the {@link Textarea} component. */
export type TextareaProps = ComponentPropsWithoutRef<typeof DialTextarea>;

/**
 * App-level textarea wrapper around `DialTextarea`.
 *
 * `DialTextarea` renders the `.dial-input` class directly on the `<textarea>`
 * element (unlike `DialInput`, which puts it on a wrapper `<div>`), so this
 * reuses `../Input/Input.scss`'s global `.dial-input` override rather than
 * duplicating it — both end up restyled from one place. All other behavior
 * (label, error, validation states) is unchanged from `DialTextarea`.
 *
 * @example
 * ```tsx
 * <Textarea id="description" value={description} onChange={setDescription} />
 * ```
 */
export const Textarea: FC<TextareaProps> = (props) => (
  <DialTextarea {...props} />
);
