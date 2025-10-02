import React, { forwardRef } from 'react';

import { getTopicColors } from '@/src/utils/app/style-helpers';

interface Props {
  topic: string;
}

export const ApplicationTopic = forwardRef<HTMLSpanElement, Props>(
  ({ topic }, ref) => {
    return (
      <span
        ref={ref}
        className="flex shrink-0 items-center self-start rounded border border-accent-primary px-1.5 py-1 text-xs leading-3"
        style={getTopicColors(topic)}
        data-qa="app-topic"
      >
        {topic}
      </span>
    );
  },
);
ApplicationTopic.displayName = 'ApplicationTopic';
