import { IconCaretRightFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ConversationComponent } from './Conversation';

interface ConversationsRendererProps {
  conversations: Conversation[];
  label: string;
}
export const ConversationsRenderer = ({
  conversations,
  label,
}: ConversationsRendererProps) => {
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );
  const [isSectionOpened, setIsSectionOpened] = useState(true);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  const handleSectionOpen = useCallback(() => {
    setIsSectionOpened((isOpen) => !isOpen);
  }, []);

  useEffect(() => {
    setIsSectionHighlighted(
      conversations.some((conv) => selectedConversationsIds.includes(conv.id)),
    );
  }, [selectedConversationsIds, conversations]);

  return (
    <>
      {conversations.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-2 pr-1">
          <button
            className={classNames(
              'flex items-center gap-1 py-1 text-xs',
              isSectionHighlighted
                ? 'text-green'
                : '[&:not(:hover)]:text-gray-500',
            )}
            data-qa="chronology"
            onClick={handleSectionOpen}
          >
            <IconCaretRightFilled
              className={classNames(
                'invisible text-gray-500 transition-all group-hover/sidebar:visible',
                isSectionOpened && 'rotate-90',
              )}
              size={10}
            />
            {label}
          </button>
          {isSectionOpened &&
            conversations.map((conversation) => (
              <ConversationComponent
                key={conversation.id}
                item={conversation}
              />
            ))}
        </div>
      )}
    </>
  );
};
