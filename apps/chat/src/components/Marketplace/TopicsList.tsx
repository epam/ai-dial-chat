import React, { useCallback, useRef, useState } from 'react';

import { stopBubbling } from '@/src/constants/chat';

import { OverflowContainer } from '@/src/components/Common/OverflowContainer';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { ApplicationTopic } from './ApplicationTopic';

interface TopicsListProps {
  topics: string[];
  counterMarginRight?: number;
}

const COUNTER_WIDTH = 30;
const maxTooltipWidth = 198;
const DISPLAY_DELAY = 100;

export const TopicsList = ({
  topics,
  counterMarginRight = 0,
}: TopicsListProps) => {
  const [openHiddenTopics, setOpenHiddenTopics] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDelayShowTooltip = useCallback((show: boolean) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => setOpenHiddenTopics(show),
      DISPLAY_DELAY,
    );
  }, []);

  const renderOverflow = (hiddenTopics: string[]) => (
    <Tooltip
      tooltip={
        <div
          className="my-1 flex flex-wrap gap-2"
          style={{ maxWidth: `${maxTooltipWidth}px` }}
          onClick={stopBubbling}
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
          handleDelayShowTooltip(!openHiddenTopics);
        }}
        onMouseEnter={() => handleDelayShowTooltip(true)}
        onMouseLeave={() => handleDelayShowTooltip(false)}
        data-qa="hidden-topics"
      >
        +{hiddenTopics.length}
      </span>
    </Tooltip>
  );

  return (
    <OverflowContainer
      items={topics}
      getKey={(topic) => topic}
      overflowIndicatorWidth={COUNTER_WIDTH + counterMarginRight}
      renderItem={(topic) => <ApplicationTopic topic={topic} />}
      renderOverflow={renderOverflow}
      className="flex w-full gap-2"
      dataQA="app-topics"
    />
  );
};
