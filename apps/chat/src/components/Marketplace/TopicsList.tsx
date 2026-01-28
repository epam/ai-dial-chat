import React, { useCallback } from 'react';

import { OverflowContainer } from '@/src/components/Common/OverflowContainer';
import { OverflowIndicator } from '@/src/components/Common/OverflowIndicator';

import { MarketplaceEntityTopic } from './MarketplaceEntityTopic';

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
        tooltipContent={hiddenItems.map((item) => (
          <MarketplaceEntityTopic
            key={item.topic}
            topic={item.topic}
            className="max-w-full truncate"
          />
        ))}
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
      renderItem={MarketplaceEntityTopic}
      renderOverflow={renderOverflow}
      className="flex w-full gap-2"
      dataQA="entity-topics"
    />
  );
};
