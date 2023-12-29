import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';
import { useState } from 'react';

import { Stage } from '@/src/types/chat';

import { MessageStage } from './MessageStage';

export interface Props {
  stages: Stage[];
}

const NUMBER_OF_VISIBLE_STAGES = 3;

export const MessageStages = ({ stages }: Props) => {
  const [showAll, setShowAll] = useState(false);

  const displayedStages = stages.slice(
    0,
    showAll ? stages.length : NUMBER_OF_VISIBLE_STAGES,
  );

  return (
    <div className="flex flex-col gap-1">
      {displayedStages.map((stage) => (
        <MessageStage key={stage.index} stage={stage} />
      ))}

      {stages.length > NUMBER_OF_VISIBLE_STAGES && (
        <button onClick={() => setShowAll(!showAll)} className="mx-auto mt-2">
          {showAll ? (
            <IconChevronsUp size={24} className="text-secondary" />
          ) : (
            <IconChevronsDown size={24} className="text-secondary" />
          )}
        </button>
      )}
    </div>
  );
};
