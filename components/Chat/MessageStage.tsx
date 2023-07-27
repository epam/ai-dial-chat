import {
  IconAlertCircleFilled,
  IconChevronDown,
  IconCircleCheckFilled,
  IconLoader,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { Stage } from '@/types/chat';

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
        <IconLoader
          size={20}
          className="shrink-0 grow-0 basis-auto animate-spin"
        />
      ) : stage.status === 'completed' ? (
        <IconCircleCheckFilled
          size={20}
          className="shrink-0 grow-0 basis-auto"
        />
      ) : (
        <IconAlertCircleFilled
          size={20}
          className="shrink-0 grow-0 basis-auto"
        />
      )}
      <span
        className={`block font-semibold ${
          isOpened ? 'max-w-full' : 'truncate'
        }`}
      >
        {stage.name}
      </span>
    </div>
  );

  return (
    <div className="dark:bg-gray-2 block min-w-0 shrink rounded-lg border text-sm dark:border-gray-900/50">
      {hasContent ? (
        <button
          className="flex w-full min-w-0 shrink items-center gap-2 p-2"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
        >
          {stageTitle}
          <IconChevronDown
            size={20}
            className={`shrink-0 transition ${isOpened ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <div className="flex p-2">{stageTitle}</div>
      )}

      <div
        className={`grid max-w-full grid-flow-row overflow-auto ${
          isOpened ? 'p-2' : 'h-0'
        }`}
      >
        {stage.content && (
          <span className="inline-block overflow-auto">
            <ChatMDComponent
              isShowResponseLoader={false}
              content={stage.content}
            />
          </span>
        )}
        {stage.attachments?.length && (
          <MessageAttachments attachments={stage.attachments} />
        )}
      </div>
    </div>
  );
};
