import type { ReactNode } from 'react';

/** Props for the {@link BuilderFormBody} component. */
export interface BuilderFormBodyProps {
  /** Start-edge column. Full width on mobile, a fixed-width column on desktop. */
  left?: ReactNode;
  /** Main column, filling the space left by `left` and `metadata`. */
  children: ReactNode;
  /** End-edge column, matching `left`'s width. When omitted while `left` is set, an empty column of the same width is reserved so the main column stays optically centered. */
  metadata?: ReactNode;
  /** Optional container-responsive column sizing; omitted preserves the existing desktop layout. */
  layout?: {
    /** Width of side columns. Defaults to '400px'. */
    sideColumnWidth?: string;
    /** Gap between columns. Defaults to '0px'. */
    columnGap?: string;
    /** Reserve an empty end column for centering. Defaults to true. */
    reserveEndColumn?: boolean;
  };
}
