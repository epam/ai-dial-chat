import { useCallback } from 'react';

import { OverflowContainer } from '@/src/components/Common/OverflowContainer';
import { OverflowIndicator } from '@/src/components/Common/OverflowIndicator';

import { MarketplaceEntityTopic } from './MarketplaceEntityTopic';

interface TopicsListProps {
  topics: string[];
  trailingReservedWidth?: number;
}

const COUNTER_WIDTH = 34;
const TOPIC_MAX_WIDTH = 180;

const getKey = (item: { topic: string }) => item.topic;

const renderTopic = ({ topic }: { topic: string }) => (
  <MarketplaceEntityTopic topic={topic} maxWidth={TOPIC_MAX_WIDTH} />
);

export const TopicsList = ({
  topics,
  trailingReservedWidth = 0,
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
            hideTooltip
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
      overflowIndicatorWidth={COUNTER_WIDTH}
      trailingReservedWidth={trailingReservedWidth}
      renderItem={renderTopic}
      renderOverflow={renderOverflow}
      className="flex w-full gap-2"
      dataQA="entity-topics"
    />
  );
};
