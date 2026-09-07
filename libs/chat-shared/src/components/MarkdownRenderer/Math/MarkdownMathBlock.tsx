import { type FC, type ReactNode, memo } from 'react';
import { useHorizontalOverflow } from '../../../hooks/useHorizontalOverflow';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './MarkdownMathBlock.module.scss';

/** Props for {@link MarkdownMathBlock}. */
export interface MarkdownMathBlockProps {
  /** Rendered KaTeX output — the `<math display="block">` element and its subtree. */
  children: ReactNode;
  /** Extra classes on the scroll container. */
  className?: string;
  /** Accessible label for the horizontally scrollable region. Defaults to `'Scrollable formula'`. */
  scrollRegionAriaLabel?: string;
}

/**
 * Wraps KaTeX display math in a horizontally scrollable region so a formula
 * wider than the message column stays reachable instead of being clipped.
 * The region only becomes a labelled, keyboard-focusable landmark while it
 * actually overflows, so ordinary formulas add no tab stop or noise.
 */
export const MarkdownMathBlock: FC<MarkdownMathBlockProps> = memo(
  ({ children, className, scrollRegionAriaLabel = 'Scrollable formula' }) => {
    const {
      scrollContainerRef,
      contentRef,
      hasContentBeyondStart,
      hasContentBeyondEnd,
      handleScroll,
    } = useHorizontalOverflow<HTMLSpanElement>();
    const isScrollable = hasContentBeyondStart || hasContentBeyondEnd;

    return (
      <div
        ref={scrollContainerRef}
        /* `overflow-x-auto` alone computes `overflow-y` to `auto` too, which adds a
           spurious vertical scrollbar once the horizontal one claims height; tall
           formulas grow the container instead, so pinning it clips nothing. */
        className={mergeClasses(
          'w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden',
          styles.scrollContainer,
          className,
        )}
        onScroll={handleScroll}
        role={isScrollable ? 'region' : undefined}
        aria-label={isScrollable ? scrollRegionAriaLabel : undefined}
        tabIndex={isScrollable ? 0 : undefined}
      >
        <span
          ref={contentRef}
          className={mergeClasses('katex', styles.mathContent)}
        >
          {children}
        </span>
      </div>
    );
  },
);
