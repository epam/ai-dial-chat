import {
  IconChevronDown,
  IconCircleCheckFilled,
  IconLoader,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { Stage } from '@/types/chat';

import ChatMDComponent from '../Markdown/ChatMDComponent';
import { MessageAttachment } from './MessageAttachment';

export interface Props {
  stage: Stage;
}

export const MessageStage = ({ stage }: Props) => {
  const [isOpened, setIsOpened] = useState(false);
  const [hasContent, setHasContent] = useState(
    () => stage?.content || stage?.attachments?.length,
  );

  useEffect(() => {
    setHasContent(stage?.content || stage?.attachments?.length);
  }, [stage]);

  const stageTitle = (
    <>
      {stage.status == null ? (
        <IconLoader size={20} className="animate-spin flex-shrink-0" />
      ) : (
        <IconCircleCheckFilled size={20} className="flex-shrink-0" />
      )}
      <span className="font-semibold">{stage.name}</span>
    </>
  );

  return (
    <div className="text-sm border rounded-lg dark:bg-gray-2 dark:border-gray-900/50">
      {hasContent ? (
        <button
          className="p-2 items-center flex gap-2 flex-wrap"
          onClick={() => {
            setIsOpened((opened) => !opened);
          }}
        >
          {stageTitle}
          <IconChevronDown
            size={20}
            className={`transition ${isOpened ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <div className="p-2 items-center flex gap-2 flex-wrap">
          {stageTitle}
        </div>
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
        <div className="flex flex-wrap max-w-full gap-1">
          {stage.attachments?.length &&
            stage.attachments.map((attachment) => (
              <MessageAttachment
                key={attachment.index}
                attachment={attachment}
              />
            ))}
        </div>
      </div>
    </div>
  );
};
