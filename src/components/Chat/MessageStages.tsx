import { Stage } from '@/src/types/chat';

import { MessageStage } from './MessageStage';

export interface Props {
  stages: Stage[];
}

export const MessageStages = ({ stages }: Props) => {
  return (
    <div className="flex flex-col gap-1">
      {stages.map((stage) => (
        <MessageStage key={stage.index} stage={stage} />
      ))}
    </div>
  );
};
