import { Checkbox } from '@epam/ai-dial-ui-kit';
import { type FC } from 'react';

/** Props for {@link MarkdownTaskCheckbox}. */
export interface MarkdownTaskCheckboxProps {
  /** Whether the GFM task-list item is checked. Defaults to `false`. */
  checked?: boolean;
}

/** Read-only checkbox for GFM task-list items (`- [ ]` / `- [x]`). */
export const MarkdownTaskCheckbox: FC<MarkdownTaskCheckboxProps> = ({
  checked = false,
}) => (
  <span className="me-1.5 inline-flex align-middle">
    <Checkbox isSelected={checked} disabled />
  </span>
);
