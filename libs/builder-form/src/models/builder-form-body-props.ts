import type { ReactNode } from 'react';

/** Props for the {@link BuilderFormBody} component. */
export interface BuilderFormBodyProps {
  /** Start-edge column. Full width on mobile, a fixed-width column on desktop. */
  left?: ReactNode;
  /** Main column, filling the space left by `left` and `metadata`. */
  children: ReactNode;
  /** End-edge column, matching `left`'s width. When omitted while `left` is set, an empty column of the same width is reserved so the main column stays optically centered. */
  metadata?: ReactNode;
}
