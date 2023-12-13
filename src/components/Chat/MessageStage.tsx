import { IconExclamationCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { Stage } from '@/src/types/chat';

import ChevronDown from '../../../public/images/icons/chevron-down.svg';
import CircleCheck from '../../../public/images/icons/circle-check.svg';
import Loader from '../../../public/images/icons/loader.svg';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachments } from './MessageAttachments';

interface StageTitleProps {
  isOpened: boolean;
  stage: Stage;
}

const StageTitle = ({ isOpened, stage }: StageTitleProps) => {
  return (
    <div
      className={`grid min-w-0 grid-flow-col items-center gap-3 overflow-hidden`}
    >
      {stage.status == null ? (
        <Loader
          height={20}
          width={20}
          className="shrink-0 grow-0 basis-auto animate-spin text-secondary"
        />
      ) : stage.status === 'completed' ? (
        <CircleCheck
          height={20}
          width={20}
          className="shrink-0 grow-0 basis-auto text-secondary"
          data-qa="stage-completed"
        />
      ) : (
        <IconExclamationCircle
          size={20}
          className="shrink-0 grow-0 basis-auto text-secondary"
        />
      )}
      <span className={`block ${isOpened ? 'max-w-full' : 'truncate'}`}>
        {stage.name}
      </span>
    </div>
  );
};

export interface Props {
  stage: Stage;
}

export const MessageStage = ({ stage }: Props) => {
  const [isOpened, setIsOpened] = useState(false);
  const [hasContent, setHasContent] = useState(
    () => !!(stage?.content || stage?.attachments?.length),
  );

  useEffect(() => {
    setHasContent(!!(stage?.content || stage?.attachments?.length));
  }, [stage?.content, stage?.attachments?.length]);

  return (
    <div className="border-gray-400 bg-gray-300 block min-w-0 shrink rounded border">
      {hasContent ? (
        <button
          className="flex w-full min-w-0 shrink items-center gap-2 p-2"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
          data-qa="message-stage"
        >
          <StageTitle isOpened={isOpened} stage={stage} />
          <ChevronDown
            height={20}
            width={20}
            className={`shrink-0 text-secondary transition ${
              isOpened ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <div className="flex p-2">
          <StageTitle isOpened={isOpened} stage={stage} />
        </div>
      )}

      {(stage.content || stage.attachments) && (
        <div
          className={`grid max-w-full grid-flow-row overflow-auto  ${
            isOpened ? 'border-gray-400 border-t p-2' : 'h-0'
          }`}
        >
          {stage.content && (
            <span className="inline-block overflow-auto">
              <ChatMDComponent
                isShowResponseLoader={false}
                content={stage.content}
                isInner
              />
            </span>
          )}
          <MessageAttachments attachments={stage.attachments} isInner />
        </div>
      )}
    </div>
  );
};
