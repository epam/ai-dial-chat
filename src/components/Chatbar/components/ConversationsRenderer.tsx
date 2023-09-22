import { Conversation } from '@/src/types/chat';

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
        <div className="px-2 pt-2">
          <div
            className="px-3 py-1 text-[12px] text-gray-500"
            data-qa="chronology"
          >
            {label}
          </div>
          {conversations.map((conversation) => (
            <ConversationComponent
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </div>
      )}
    </>
  );
};
