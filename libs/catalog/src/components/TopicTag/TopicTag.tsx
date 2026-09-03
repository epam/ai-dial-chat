import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tooltip } from '@epam/ai-dial-ui-kit';
import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { CardTag } from '../CardTag/CardTag';

/** Color overrides for `TopicTag`, applied as CSS custom properties. */
export interface TopicTagColors {
  /** Tag text color. Fallback: `--text-secondary`. */
  text?: string;
  /** Tag border color. Fallback: `--stroke-tertiary`. */
  border?: string;
  /** Tag background color. Fallback: `--bg-layer-sunken`. */
  background?: string;
}

/** Props for TopicTag. */
export interface TopicTagProps {
  /** Text to display inside the tag, e.g. 'Free' or 'Pay-as-you-go'. */
  label: string;
  /** CSS class for the tag text. Default: 'dial-tiny-text'. */
  className?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: TopicTagColors;
}

/** Simple tag component for displaying item topics or pricing tiers. */
export const TopicTag: FC<TopicTagProps> = ({
  label,
  className = 'dial-tiny-text',
  colors,
}) => <CardTag label={label} badgeClassName={className} colors={colors} />;

/** Props for TopicsLine. */
export interface TopicsLineProps {
  /** Topics to display as tags. */
  topics: string[];
  /**
   * Returns the aria-label for the overflow "+N" badge.
   * Receives the overflow count. Defaults to `"and N more topics"`.
   */
  overflowAriaLabel?: (count: number) => string;
  /** Extra classes on the root element (e.g. to constrain width in a table cell). */
  className?: string;
}

/* Matches the `gap-2` Tailwind class on the root element below. */
const GAP = 8;

/** Renders topics on a single line, collapsing overflow into a "+N" badge. */
export const TopicsLine: FC<TopicsLineProps> = ({
  topics,
  overflowAriaLabel,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tagWidthCacheRef = useRef<number[]>([]);
  const badgeRef = useRef<HTMLDivElement>(null);
  /*
   * Ceiling written by the overflow guard below. The prediction from cached
   * widths runs on every render, so a correction it does not know about would
   * be undone on the next pass; keeping the ceiling here makes the guard win
   * until the topics or the container change.
   */
  const maxVisibleRef = useRef(Number.POSITIVE_INFINITY);

  const [visibleCount, setVisibleCount] = useState(topics.length);

  const topicsKey = topics.join('\0');

  /*
   * Tag widths are cached from the one render where every tag is mounted
   * (visibleCount === topics.length) and reused afterwards. Once tags are
   * collapsed into "+N" they leave the DOM, so re-measuring the *container*
   * on resize must not depend on re-reading widths from tags that are no
   * longer there — and the container itself must not be the resize target,
   * since shrinking its own content would otherwise look like an external
   * resize and cause it to over-collapse.
   */
  const computeVisibleCount = useCallback(() => {
    const container = containerRef.current;
    if (!container || topics.length === 0) return;

    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;

    const allMounted = tagRefs.current
      .slice(0, topics.length)
      .every((el) => el != null);
    if (allMounted) {
      tagWidthCacheRef.current = tagRefs.current
        .slice(0, topics.length)
        .map((el) => el?.offsetWidth ?? 0);
    }

    const widths = tagWidthCacheRef.current;
    if (widths.length !== topics.length) return;

    const badgeWidth = badgeRef.current?.offsetWidth ?? 0;

    let usedWidth = 0;
    let count = 0;
    for (let i = 0; i < topics.length; i++) {
      const needsBadge = topics.length - (i + 1) > 0;
      const projectedWidth =
        usedWidth +
        (i > 0 ? GAP : 0) +
        widths[i] +
        (needsBadge ? GAP + badgeWidth : 0);

      if (projectedWidth > containerWidth) break;

      usedWidth += (i > 0 ? GAP : 0) + widths[i];
      count = i + 1;
    }

    setVisibleCount(Math.min(count, maxVisibleRef.current));
  }, [topics.length]);

  useLayoutEffect(() => {
    tagWidthCacheRef.current = [];
    maxVisibleRef.current = Number.POSITIVE_INFINITY;
    setVisibleCount(topics.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey]);

  useLayoutEffect(() => {
    computeVisibleCount();
  });

  /*
   * The prediction above trusts widths measured earlier, which can be stale —
   * a tag measured before its web font loaded, or a cell that ended up
   * narrower than it reported. Its only symptom is the one the layout must
   * never show: a tag clipped mid-word with no "+N" badge to reveal it. The
   * laid-out row is the ground truth, so drop one more tag whenever it still
   * overflows, until it fits.
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || visibleCount === 0) return;
    if (container.scrollWidth <= container.clientWidth) return;

    maxVisibleRef.current = visibleCount - 1;
    setVisibleCount(maxVisibleRef.current);
  }, [visibleCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      /* A new width invalidates the ceiling the guard settled on. */
      maxVisibleRef.current = Number.POSITIVE_INFINITY;
      computeVisibleCount();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [computeVisibleCount]);

  if (topics.length === 0) {
    return (
      <div
        ref={containerRef}
        className={mergeClasses(
          'relative flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden',
          className,
        )}
      />
    );
  }

  const overflow = topics.length - visibleCount;

  return (
    <div
      ref={containerRef}
      className={mergeClasses(
        'flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden',
        className,
      )}
    >
      {topics.slice(0, visibleCount).map((p, index) => (
        <div
          key={p}
          ref={(el) => {
            tagRefs.current[index] = el;
          }}
        >
          <TopicTag label={p} />
        </div>
      ))}
      {overflow > 0 && (
        <Tooltip tooltip={topics.slice(visibleCount).join(', ')}>
          <span
            aria-label={
              overflowAriaLabel?.(overflow) ?? `and ${overflow} more topics`
            }
          >
            <TopicTag label={`+${overflow}`} />
          </span>
        </Tooltip>
      )}
      {/* Measures the badge before it is needed. Pinned to the container's own
          start corner (not outside it) so it never counts as overflow for the
          guard above, in either writing direction. */}
      <div
        ref={badgeRef}
        aria-hidden
        className="invisible absolute start-0 top-0"
      >
        <TopicTag label={`+${topics.length}`} />
      </div>
    </div>
  );
};
