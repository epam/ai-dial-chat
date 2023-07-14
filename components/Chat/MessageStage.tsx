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
      className={`grid grid-flow-col items-center gap-3 ${isOpened ? '' : ' '}`}
    >
      {stage.status == null ? (
        <IconLoader
          size={20}
          className="animate-spin flex-shrink-0 grow-0 basis-auto"
        />
      ) : stage.status === 'completed' ? (
        <IconCircleCheckFilled
          size={20}
          className="flex-shrink-0 grow-0 basis-auto"
        />
      ) : (
        <IconAlertCircleFilled
          size={20}
          className="flex-shrink-0 grow-0 basis-auto"
        />
      )}
      <span
        className={`font-semibold ${
          isOpened
            ? 'max-w-full'
            : 'overflow-hidden text-ellipsis whitespace-nowrap'
        }`}
      >
        {stage.name}
      </span>
    </div>
  );

  return (
    <div className="min-w-0 block text-sm border rounded-lg dark:bg-gray-2 dark:border-gray-900/50">
      {hasContent ? (
        <button
          className="p-2 items-center flex gap-2 w-full"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
        >
          {stageTitle}
          <IconChevronDown
            size={20}
            className={`transition flex-shrink-0 ${
              isOpened ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <div className="p-2">{stageTitle}</div>
      )}

      <div className={`overflow-hidden ${isOpened ? 'p-2' : 'h-0'}`}>
        {stage.content && (
          <span className="inline-block">
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
