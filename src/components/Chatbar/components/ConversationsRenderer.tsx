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
        <div className="flex flex-col gap-1 pl-2 pr-0.5 pt-2">
          <div className="px-3 py-1 text-xs text-gray-500" data-qa="chronology">
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
