import { useEffect, useState } from 'react';

import { Conversation } from '@/src/types/chat';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import CollapsedSection from '../../Common/CollapsedSection';
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
        <CollapsedSection
          name={label}
          dataQa="chronology"
          isHighlighted={isSectionHighlighted}
          openByDefault
        >
          {conversations.map((conversation) => (
            <ConversationComponent key={conversation.id} item={conversation} />
          ))}
        </CollapsedSection>
      )}
    </>
  );
};
