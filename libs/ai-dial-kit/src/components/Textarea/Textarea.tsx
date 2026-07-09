import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTextarea } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';
import '../Input/Input.scss';

/** Props for the {@link Textarea} component. */
export type TextareaProps = ComponentPropsWithoutRef<typeof DialTextarea>;

/**
 * App-level textarea wrapper around `DialTextarea`.
 *
 * Restyles the corner radius and resting border color to match `Input`'s
 * rounded, lighter-bordered field language — `DialTextarea` renders with the
 * same `.dial-input` class as `DialInput`, so it reuses `../Input/Input.scss`
 * rather than duplicating the override. All other behavior (label, error,
 * validation states) is unchanged from `DialTextarea`.
 *
 * @example
 * ```tsx
 * <Textarea id="description" value={description} onChange={setDescription} />
 * ```
 */
export const Textarea: FC<TextareaProps> = ({ className, ...props }) => (
  <DialTextarea {...props} className={mergeClasses('!rounded-xl', className)} />
);
