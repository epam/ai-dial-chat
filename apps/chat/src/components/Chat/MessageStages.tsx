import { useState } from 'react';

import classNames from 'classnames';

import { Stage } from '@/src/types/chat';

import { MessageStage } from './MessageStage';

import ChevronDown from '@/public/images/icons/chevron-down.svg';

export interface Props {
  stages: Stage[];
}

const NUMBER_OF_VISIBLE_STAGES = 3;

export const MessageStages = ({ stages }: Props) => {
  const [showMore, setShowMore] = useState(false);

  const displayedStages = stages.slice(
    0,
    showMore ? stages.length : NUMBER_OF_VISIBLE_STAGES,
  );

  return (
    <div data-no-context-menu className="flex flex-col gap-1">
      {displayedStages.map((stage) => (
        <MessageStage key={stage.index} stage={stage} />
      ))}
      {stages.length > NUMBER_OF_VISIBLE_STAGES && (
        <button
          onClick={() => setShowMore(!showMore)}
          className="mt-2 flex leading-[18px] text-accent-primary"
          data-qa={showMore ? 'show-less' : 'show-more'}
        >
          {showMore ? 'Show less' : 'Show more'}
          <ChevronDown
            height={18}
            width={18}
            className={classNames(
              'ml-2 shrink-0 transition',
              showMore && 'rotate-180',
            )}
          />
        </button>
      )}
    </div>
  );
};
