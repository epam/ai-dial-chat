import React, { memo, useCallback, useEffect, useRef, useState } from 'react';

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
}

const counterWidth = 30;
const leftTopicPadding = 8;

export const TopicsList = ({ topics }: TopicsListProps) => {
  const [visibleTopics, setVisibleTopics] = useState<string[]>([]);
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([]);
  const allTopicsRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const checkOverflow = useCallback(() => {
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
      const containerWidth = containerRef.current.offsetWidth - counterWidth;
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
  }, [topics]);

  useEffect(() => {
    checkOverflow();
  }, [checkOverflow, topics]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        checkOverflow();
      }, 30);
    };

    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [checkOverflow]);

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
