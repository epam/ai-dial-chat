import React, { useCallback } from 'react';

import { OverflowContainer } from '@/src/components/Common/OverflowContainer';
import { OverflowIndicator } from '@/src/components/Common/OverflowIndicator';

import { ApplicationTopic } from './ApplicationTopic';

interface TopicsListProps {
  topics: string[];
  counterMarginRight?: number;
}

const COUNTER_WIDTH = 30;
const getKey = (item: { topic: string }) => item.topic;

export const TopicsList = ({
  topics,
  counterMarginRight = 0,
}: TopicsListProps) => {
  const items = topics.map((topic) => ({ topic }));

  const renderOverflow = useCallback(
    (hiddenItems: { topic: string }[]) => (
      <OverflowIndicator
        count={hiddenItems.length}
        tooltipContent={
          <>
            {hiddenItems.map((item) => (
              <ApplicationTopic key={item.topic} topic={item.topic} />
            ))}
          </>
        }
        placement="top"
        displayDelay={100}
        dataQA="hidden-topics"
      />
    ),
    [],
  );

  return (
    <OverflowContainer
      items={items}
      getKey={getKey}
      overflowIndicatorWidth={COUNTER_WIDTH + counterMarginRight}
      renderItem={ApplicationTopic}
      renderOverflow={renderOverflow}
      className="flex w-full gap-2"
      dataQA="entity-topics"
    />
  );
};
