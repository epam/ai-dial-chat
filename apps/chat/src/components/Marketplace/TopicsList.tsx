import React, { memo, useEffect, useRef, useState } from 'react';

import { stopBubbling } from '@/src/constants/chat';

import Tooltip from '../Common/Tooltip';
import { ApplicationTopic } from './ApplicationTopic';

interface AllTopicsProps {
  topics: string[];
  allTopicsRef: React.RefObject<HTMLDivElement>;
}

const AllTopics = memo(({ topics, allTopicsRef }: AllTopicsProps) => {
  return (
    <div
      className="invisible fixed top-0 flex gap-2 font-theme"
      ref={allTopicsRef}
    >
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

const counterWidth = 30;
const innerMaxTooltipWidth = 198;
const topicGap = 8;

export const TopicsList = ({
  topics,
  counterMarginRight = 0,
}: TopicsListProps) => {
  const [visibleTopics, setVisibleTopics] = useState<string[]>([]);
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([]);
  const allTopicsRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maxTooltipWidth, setMaxTooltipWidth] = useState<number>(0);
  const [openHiddenTopics, setOpenHiddenTopics] = useState<boolean>(false);

  const extraSpace = counterWidth + counterMarginRight;

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && allTopicsRef.current) {
        if (
          allTopicsRef.current.getBoundingClientRect().width <=
          containerRef.current.getBoundingClientRect().width
        ) {
          setVisibleTopics(topics);
          setHiddenTopics([]);
        } else {
          const initialVisibleTopics: string[] = [];
          const initialHiddenTopics: string[] = [];
          const children = Array.from(allTopicsRef.current.children);
          const containerWidth =
            containerRef.current.getBoundingClientRect().width - extraSpace;
          let occupiedWidth = 0;

          const hiddenTopicWidths: { topic: string; topicWidth: number }[] = [];

          children.forEach((childNode, index) => {
            const element = childNode as HTMLElement;

            const elementWidth = element.getBoundingClientRect().width;

            if (occupiedWidth + elementWidth + topicGap <= containerWidth) {
              initialVisibleTopics.push(topics[index]);
              occupiedWidth += elementWidth + topicGap;
            } else {
              initialHiddenTopics.push(topics[index]);
              hiddenTopicWidths.push({
                topic: topics[index],
                topicWidth: elementWidth,
              });
            }
          });

          setVisibleTopics(initialVisibleTopics);
          setHiddenTopics(initialHiddenTopics);

          let maxRowWidth = 0,
            currentRowWidth = -topicGap;
          for (const { topicWidth } of hiddenTopicWidths) {
            if (
              currentRowWidth + topicWidth + topicGap >
              innerMaxTooltipWidth
            ) {
              maxRowWidth = Math.max(currentRowWidth, maxRowWidth);
              currentRowWidth = topicWidth;
            } else {
              currentRowWidth += topicWidth + topicGap;
            }
          }
          maxRowWidth = Math.max(currentRowWidth, maxRowWidth);

          setMaxTooltipWidth(maxRowWidth);
        }
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
              <div
                className="my-1 flex flex-wrap gap-2"
                style={{ maxWidth: `${maxTooltipWidth}px` }}
              >
                {hiddenTopics.map((topic) => (
                  <ApplicationTopic key={topic} topic={topic} />
                ))}
              </div>
            }
            open={openHiddenTopics}
            onOpenChange={setOpenHiddenTopics}
            placement="top"
          >
            <span
              className="flex cursor-pointer items-center rounded border border-accent-primary px-1.5 py-1 text-xs leading-3"
              onClick={(event) => {
                stopBubbling(event);
                setOpenHiddenTopics(!openHiddenTopics);
              }}
              onMouseEnter={() => setOpenHiddenTopics(true)}
              onMouseLeave={() => setOpenHiddenTopics(false)}
            >
              +{hiddenTopics.length}
            </span>
          </Tooltip>
        )}
      </div>
    </>
  );
};
