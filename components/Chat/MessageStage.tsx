import { useEffect, useState } from 'react';

import { Stage } from '@/types/chat';

import ChevronDown from '../../public/images/icons/chevron-down.svg';
import CircleCheck from '../../public/images/icons/circle-check.svg';
import CircleExclamation from '../../public/images/icons/circle-exclamation.svg';
import Loader from '../../public/images/icons/loader.svg';
import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachments } from './MessageAttachments';

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

  const stageTitle = (
    <div
      className={`grid min-w-0 grid-flow-col items-center gap-3 overflow-hidden`}
    >
      {stage.status == null ? (
        <Loader
          height={20}
          width={20}
          className="shrink-0 grow-0 basis-auto animate-spin text-gray-500"
        />
      ) : stage.status === 'completed' ? (
        <CircleCheck
          height={20}
          width={20}
          className="shrink-0 grow-0 basis-auto text-gray-500"
        />
      ) : (
        <CircleExclamation
          height={20}
          width={20}
          className="shrink-0 grow-0 basis-auto text-gray-500"
        />
      )}
      <span className={`block ${isOpened ? 'max-w-full' : 'truncate'}`}>
        {stage.name}
      </span>
    </div>
  );

  return (
    <div className="block min-w-0 shrink rounded border border-gray-400 bg-gray-300 dark:border-gray-700 dark:bg-gray-900">
      {hasContent ? (
        <button
          className="flex w-full min-w-0 shrink items-center gap-2 p-2"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
        >
          {stageTitle}
          <ChevronDown
            height={20}
            width={20}
            className={`shrink-0 text-gray-500 transition ${
              isOpened ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <div className="flex p-2">{stageTitle}</div>
      )}

      {(stage.content || stage.attachments) && (
        <div
          className={`grid max-w-full grid-flow-row overflow-auto  ${
            isOpened
              ? 'border-t border-gray-400 p-2 dark:border-gray-700'
              : 'h-0'
          }`}
        >
          {stage.content && (
            <span className="inline-block overflow-auto">
              <ChatMDComponent
                isShowResponseLoader={false}
                content={stage.content}
                isInner={true}
              />
            </span>
          )}
          {stage.attachments?.length && (
            <MessageAttachments attachments={stage.attachments} />
          )}
        </div>
      )}
    </div>
  );
};
