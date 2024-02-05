import { useEffect, useState } from 'react';

import { Conversation } from '@/src/types/chat';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import CollapsableSection from '../Common/CollapsableSection';
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
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  useEffect(() => {
    setIsSectionHighlighted(
      conversations.some((conv) => selectedConversationsIds.includes(conv.id)),
    );
  }, [selectedConversationsIds, conversations]);

  return (
    <>
      {conversations.length > 0 && (
        <CollapsableSection
          name={label}
          dataQa="chronology"
          isHighlighted={isSectionHighlighted}
          openByDefault
        >
          <div className="flex flex-col gap-1 py-1">
            {conversations.map((conversation) => (
              <ConversationComponent
                key={conversation.id}
                item={conversation}
              />
            ))}
          </div>
        </CollapsableSection>
      )}
    </>
  );
};
