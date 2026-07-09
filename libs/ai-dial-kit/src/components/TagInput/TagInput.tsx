import { DialTagInput } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';

/** Props for the {@link TagInput} component. */
export type TagInputProps = ComponentPropsWithoutRef<typeof DialTagInput>;

/**
 * App-level tag input wrapper around `DialTagInput`.
 *
 * Currently a thin pass-through: `DialTagInput` does not expose a stable
 * class hook for its outer field border, so no corner-radius override is
 * applied yet (unlike {@link Input}/{@link Textarea}). Restyle here once a
 * suitable hook is available, so all three field types stay visually
 * consistent from one place.
 *
 * @example
 * ```tsx
 * <TagInput elementId="topics" label="Topics" onChange={setTopics} />
 * ```
 */
export const TagInput: FC<TagInputProps> = (props) => (
  <DialTagInput {...props} />
);
