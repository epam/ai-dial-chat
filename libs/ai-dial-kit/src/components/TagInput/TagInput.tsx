import { DialTagInput } from '@epam/ai-dial-ui-kit';
import { type ComponentPropsWithoutRef, type FC } from 'react';

/** Props for the {@link TagInput} component. */
export type TagInputProps = ComponentPropsWithoutRef<typeof DialTagInput>;

/**
 * App-level tag input wrapper around `DialTagInput`.
 *
 * @example
 * ```tsx
 * <TagInput elementId="topics" label="Topics" onChange={setTopics} />
 * ```
 */
export const TagInput: FC<TagInputProps> = (props) => (
  <DialTagInput {...props} />
);
