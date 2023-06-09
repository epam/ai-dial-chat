import { useEffect, useState } from 'react';

import { Conversation } from '@/types/chat';

interface Props {
  conversations: Conversation[];
  selectedConversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
}

export const ChatCompareSelect = ({
  conversations,
  selectedConversations,
  onConversationSelect,
}: Props) => {
  const [comparableConversations, setComparableConversations] = useState<
    Conversation[]
  >([]);

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations.filter((conv) => {
        if (conv.id === selectedConversation.id) {
          return false;
        }
        const convUserMessages = conv.messages.filter(
          (message) => message.role === 'user',
        );
        const selectedConvUserMessages = selectedConversation.messages.filter(
          (message) => message.role === 'user',
        );

        if (convUserMessages.length !== selectedConvUserMessages.length) {
          return false;
        }

        let isNotSame = false;
        for (let i = 0; i < convUserMessages.length; i++) {
          if (
            convUserMessages[i].content !== selectedConvUserMessages[i].content
          ) {
            isNotSame = true;
          }
          break;
        }

        if (isNotSame) {
          return false;
        }

        return true;
      });
      setComparableConversations(comparableConversations);
    }
  }, [conversations, selectedConversations]);

  return (
    <div className="flex flex-col items-start">
      <h5 className="h-full">Select Conversation</h5>
      <select
        onChange={(e) => {
          const selectedOption = conversations
            .filter((val) => val.id === e.target.value)
            .pop();

          if (selectedOption) {
            onConversationSelect(selectedOption);
          }
        }}
        value="''"
      >
        <option value="''">Select Option</option>
        {comparableConversations.map((val) => (
          <option key={val.id} value={val.id}>
            {val.name}
          </option>
        ))}
      </select>
    </div>
  );
};
