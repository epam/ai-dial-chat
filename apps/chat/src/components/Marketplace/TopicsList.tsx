import React, { useCallback } from 'react';

import { OverflowContainer } from '@/src/components/Common/OverflowContainer';
import { OverflowIndicator } from '@/src/components/Common/OverflowIndicator';

import { ApplicationTopic } from './ApplicationTopic';

interface TopicsListProps {
  topics: string[];
  counterMarginRight?: number;
}

const COUNTER_WIDTH = 30;

export const TopicsList = ({
  topics,
  counterMarginRight = 0,
}: TopicsListProps) => {
  const renderOverflow = useCallback(
    (hiddenTopics: string[]) => (
      <OverflowIndicator
        count={hiddenTopics.length}
        tooltipContent={
          <>
            {hiddenTopics.map((topic) => (
              <ApplicationTopic key={topic} topic={topic} />
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
