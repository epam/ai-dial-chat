import { Button } from '@epam/ai-dial-ui-kit';
import type { ComponentProps, FC, MouseEvent } from 'react';
import { isModifiedClick } from '../../utils/click';

/** Props for `RowLink`. */
export interface RowLinkProps extends Omit<
  ComponentProps<typeof Button>,
  'href' | 'onClick' | 'tabIndex'
> {
  /** Browser-navigable URL of the row; when set, the row is a link and a plain click calls `onSelect` instead of navigating. */
  href?: string;
  /** Called when the row is activated. */
  onSelect: () => void;
}

/** The activatable area of a list row: one kit `Button`, rendered as a link when `href` is set and as a button otherwise. */
export const RowLink: FC<RowLinkProps> = ({
  href,
  onSelect,
  ...buttonProps
}) => {
  /* One element is the tab stop and the link, so middle-click and "open in new tab" keep working. */
  const handleClick = (event: MouseEvent) => {
    if (href) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      event.preventDefault();
    }
    onSelect();
  };

  return <Button {...buttonProps} href={href} onClick={handleClick} />;
};
