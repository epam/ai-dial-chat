import { DialCheckbox } from '@epam/ai-dial-ui-kit';
import { type FC, useId } from 'react';

/** Props for {@link MarkdownTaskCheckbox}. */
export interface MarkdownTaskCheckboxProps {
  /** Whether the GFM task-list item is checked. Defaults to `false`. */
  checked?: boolean;
}

/** Read-only checkbox for GFM task-list items (`- [ ]` / `- [x]`). */
export const MarkdownTaskCheckbox: FC<MarkdownTaskCheckboxProps> = ({
  checked = false,
}) => {
  const id = useId();

  return (
    <span className="me-1.5 inline-flex align-middle">
      <DialCheckbox id={id} checked={checked} disabled />
    </span>
  );
};
