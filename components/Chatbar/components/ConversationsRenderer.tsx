import { Conversation } from '@/types/chat';

import { ConversationComponent } from './Conversation';

interface ConversationsRendererProps {
  conversations: Conversation[];
  label: string;
}
export const ConversationsRenderer = ({
  conversations,
  label,
}: ConversationsRendererProps) => {
  return (
    <>
      {conversations.length > 0 && (
        <>
          <div className="ml-2 text-[#7F8792]">{label}</div>
          {conversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </>
      )}
    </>
  );
};
