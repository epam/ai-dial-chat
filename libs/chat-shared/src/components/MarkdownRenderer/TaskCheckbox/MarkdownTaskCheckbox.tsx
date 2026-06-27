import { DialCheckbox } from '@epam/ai-dial-ui-kit';
import { type FC, useId } from 'react';

/** Props for {@link MarkdownTaskCheckbox}. */
export interface MarkdownTaskCheckboxProps {
  /** Whether the GFM task-list item is checked. */
  checked?: boolean;
}

/**
 * Read-only checkbox rendered for GFM task-list items (`- [ ]` / `- [x]`),
 * styled with the design-system {@link DialCheckbox}. The wrapping span keeps the
 * control inline with the surrounding list-item text regardless of the checkbox layout.
 */
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
