import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
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
  topics: string[];
}

export const TopicsLine: FC<TopicsLineProps> = ({ topics }) => {
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

    const firstTop = children[0].offsetTop;
    const rowHeight = children[0].offsetHeight;
    const limitTop = firstTop + rowHeight * 2;

    let cutoff = children.length;
    for (let i = 0; i < children.length; i++) {
      if (children[i].offsetTop >= limitTop) {
        cutoff = i;
        break;
      }
    }

    // If there is overflow, reduce by one to leave room for the "+N" badge
    setVisibleCount(
      cutoff < children.length ? Math.max(0, cutoff - 1) : children.length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey, 2]);

  const overflow = topics.length - visibleCount;

  return (
    <div ref={topicsRef} className="flex flex-wrap gap-2">
      {topics.slice(0, visibleCount).map((p) => (
        <TopicTag key={p} label={p} />
      ))}
      {overflow > 0 && <TopicTag label={`+${overflow}`} />}
    </div>
  );
};
