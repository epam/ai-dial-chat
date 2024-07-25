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
  const [showPrevious, setShowPrevious] = useState(false);

  const displayedStages = stages.slice(
    showPrevious ? -stages.length : -NUMBER_OF_VISIBLE_STAGES,
  );

  return (
    <div data-no-context-menu className="flex flex-col gap-1">
      {stages.length > NUMBER_OF_VISIBLE_STAGES && (
        <button
          onClick={() => setShowPrevious(!showPrevious)}
          className="mb-2 flex leading-[18px] text-accent-primary"
          data-qa={showPrevious ? 'hide-previous' : 'show-previous'}
        >
          {showPrevious ? 'Hide previous' : 'Show previous'}
          <ChevronDown
            height={18}
            width={18}
            className={classNames(
              'ml-2 shrink-0 transition',
              !showPrevious && 'rotate-180',
            )}
          />
        </button>
      )}
      {displayedStages.map((stage) => (
        <MessageStage key={stage.index} stage={stage} />
      ))}
    </div>
  );
};
