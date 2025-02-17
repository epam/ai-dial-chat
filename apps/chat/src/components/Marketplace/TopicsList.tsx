import React, { memo, useEffect, useRef, useState } from 'react';

import Tooltip from '../Common/Tooltip';
import { ApplicationTopic } from './ApplicationTopic';

interface AllTopicsProps {
  topics: string[];
  allTopicsRef: React.RefObject<HTMLDivElement>;
}

const AllTopics = memo(({ topics, allTopicsRef }: AllTopicsProps) => {
  return (
    <div className="invisible absolute top-0 flex gap-2" ref={allTopicsRef}>
      {topics.map((topic) => (
        <ApplicationTopic key={topic} topic={topic} />
      ))}
    </div>
  );
});

AllTopics.displayName = 'AllTopics';

interface TopicsListProps {
  topics: string[];
  counterMarginRight?: number;
}

const leftTopicPadding = 8;
const counterWidth = 30;

export const TopicsList = ({
  topics,
  counterMarginRight = 0,
}: TopicsListProps) => {
  const [visibleTopics, setVisibleTopics] = useState<string[]>([]);
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([]);
  const allTopicsRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const extraSpace = counterWidth + counterMarginRight;

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && allTopicsRef.current) {
        if (
          allTopicsRef.current.offsetWidth <= containerRef.current.offsetWidth
        ) {
          setVisibleTopics(topics);
          setHiddenTopics([]);
        }

        const initialVisibleTopics: string[] = [];
        const initialHiddenTopics: string[] = [];
        const children = Array.from(allTopicsRef.current.children);
        const containerWidth = containerRef.current.offsetWidth - extraSpace;
        let occupiedWidth = 0;

        const visibleTopicWidths: { topic: string; width: number }[] = [];

        children.forEach((childNode, index) => {
          const element = childNode as HTMLElement;
          const elementWidth = element.offsetWidth + leftTopicPadding;

          if (occupiedWidth + elementWidth <= containerWidth) {
            initialVisibleTopics.push(topics[index]);
            visibleTopicWidths.push({
              topic: topics[index],
              width: elementWidth,
            });
            occupiedWidth += elementWidth;
          } else {
            initialHiddenTopics.push(topics[index]);
          }
        });

        setVisibleTopics(initialVisibleTopics);
        setHiddenTopics(initialHiddenTopics);
      }
    };
    const resizeObserver = new ResizeObserver(checkOverflow);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [extraSpace, topics]);

  return (
    <>
      <AllTopics topics={topics} allTopicsRef={allTopicsRef} />
      <div className="flex w-full gap-2" ref={containerRef}>
        {visibleTopics.map((topic) => (
          <ApplicationTopic key={topic} topic={topic} />
        ))}

        {hiddenTopics.length > 0 && (
          <Tooltip
            tooltip={
              <div className="my-1 flex max-w-48 flex-wrap gap-2">
                {hiddenTopics.map((topic) => (
                  <ApplicationTopic key={topic} topic={topic} />
                ))}
              </div>
            }
            placement="top"
          >
            <span className="flex cursor-pointer items-center rounded border border-accent-primary px-1.5 py-1 text-xs leading-3">
              +{hiddenTopics.length}
            </span>
          </Tooltip>
        )}
      </div>
    </>
  );
};
