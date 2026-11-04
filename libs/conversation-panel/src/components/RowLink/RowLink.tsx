import { Button } from '@epam/ai-dial-ui-kit';
import type { ComponentProps, FC } from 'react';

/** Props for `RowLink`. */
export interface RowLinkProps extends Omit<
  ComponentProps<typeof Button>,
  'href' | 'onClick' | 'tabIndex'
> {
  /** Browser-navigable URL of the row; when set, the link takes focus and a click calls `onSelect` instead of navigating. */
  href?: string;
  /** Called when the row is activated. */
  onSelect: () => void;
}

/** The activatable area of a list row: a link around the row button when `href` is set, the button alone otherwise. */
export const RowLink: FC<RowLinkProps> = ({
  href,
  onSelect,
  'aria-label': ariaLabel,
  ...buttonProps
}) => (
  /* With `href` the link is the one tab stop and carries the name, so
     middle-click and "open in new tab" work; the button inside only draws
     the row and leaves the tab order. Without it, the button is the control. */
  <a
    href={href}
    aria-label={href ? ariaLabel : undefined}
    className="contents"
    onClick={(e) => {
      if (!href) return;
      e.preventDefault();
      onSelect();
    }}
  >
    <Button
      {...buttonProps}
      aria-label={ariaLabel}
      onClick={href ? undefined : onSelect}
      tabIndex={href ? -1 : undefined}
    />
  </a>
);
