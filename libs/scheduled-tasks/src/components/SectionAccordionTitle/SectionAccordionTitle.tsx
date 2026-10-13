import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, type ReactNode } from 'react';

/** Props for the {@link SectionAccordionTitle} component. */
export interface SectionAccordionTitleProps {
  /** CSS class applied to the title text, e.g. `'dial-tiny-semi-text'`. */
  className: string;
  /** Title text. */
  children: ReactNode;
}

/**
 * Accordion title span that escapes the kit title strut, rendering at its
 * own line height inside a 24px-tall element. Internal to the conversation
 * panel sections; not exported from the package.
 */
export const SectionAccordionTitle: FC<SectionAccordionTitleProps> = ({
  className,
  children,
}) => (
  /*
   * `block` breaks the title out of the kit title span's `dial-body-text`
   * strut (line-height 24) — an inline child can never shrink a line box
   * below the parent's strut, so the 12/16 title needs its own block.
   * `py-1` grows that block to the design's 24px title height, keeping
   * the 16px text line vertically centered.
   */
  <span className={mergeClasses(className, 'block truncate py-1')}>
    {children}
  </span>
);
