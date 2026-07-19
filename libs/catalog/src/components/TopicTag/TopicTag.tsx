import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag, DialTooltip } from '@epam/ai-dial-ui-kit';
import { FC, useLayoutEffect, useRef, useState } from 'react';
import styles from './TopicTag.module.scss';

/** Props for TopicTag. */
export interface TopicTagProps {
  /** Text to display inside the tag, e.g. 'Free' or 'Pay-as-you-go'. */
  label: string;
  /** CSS class for the tag text. Default: 'dial-tiny-text'. */
  className?: string;
}

/** Simple tag component for displaying item topics or pricing tiers. */
export const TopicTag: FC<TopicTagProps> = ({
  label,
  className = 'dial-tiny-text',
}) => <DialTag label={label} className={mergeClasses(className, styles.tag)} />;

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

/**
 * Renders topics on a single line, collapsing whatever doesn't fit into a
 * "+N" overflow badge. The row never wraps — this is measured by horizontal
 * overflow (each tag's right edge vs. the container width), not by row
 * position, so it works the same whether the container is loosely sized
 * (card grid) or a fixed-width table cell (list view).
 */
export const TopicsLine: FC<TopicsLineProps> = ({
  topics,
  overflowAriaLabel,
  className,
}) => {
  const [visibleCount, setVisibleCount] = useState(topics.length);
  const topicsRef = useRef<HTMLDivElement>(null);

  const topicsKey = topics.join('\0');

  useLayoutEffect(() => {
    const container = topicsRef.current;
    if (!container || topics.length === 0) {
      setVisibleCount(topics.length);
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return;

    const containerWidth = container.clientWidth;

    let cutoff = children.length;
    for (let i = 0; i < children.length; i++) {
      if (children[i].offsetLeft + children[i].offsetWidth > containerWidth) {
        cutoff = i;
        break;
      }
    }

    // If there is overflow, reduce by one to leave room for the "+N" badge
    setVisibleCount(
      cutoff < children.length ? Math.max(0, cutoff - 1) : children.length,
    );
  }, [topicsKey, topics.length]);

  const overflow = topics.length - visibleCount;

  return (
    <div
      ref={topicsRef}
      className={mergeClasses(
        'flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden',
        className,
      )}
    >
      {topics.slice(0, visibleCount).map((p) => (
        <TopicTag key={p} label={p} />
      ))}
      {overflow > 0 && (
        <DialTooltip tooltip={topics.slice(visibleCount).join(', ')}>
          <span
            aria-label={
              overflowAriaLabel?.(overflow) ?? `and ${overflow} more topics`
            }
          >
            <TopicTag label={`+${overflow}`} />
          </span>
        </DialTooltip>
      )}
    </div>
  );
};
