import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('chat');
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
    <div className="flex flex-col items-center justify-center h-full text-base text-black/80 dark:text-white/80">
      <div className="mb-5 flex flex-col text-center max-w-[300px]">
        <h5>{t('Select Conversation to compare with')}</h5>
        <i>
          (
          {t(
            'Note: only conversations with same user messages can be compared',
          )}
          )
        </i>
      </div>
      <select
        className="bg-[#40414F] p-3 rounded-md min-w-[150px] border border-gray-900/50"
        onChange={(e) => {
          const selectedOption = conversations
            .filter((val) => val.id === e.target.value)
            .pop();

          if (selectedOption) {
            onConversationSelect(selectedOption);
          }
        }}
        value="null"
      >
        {comparableConversations.length === 0 ? (
          <option value="null">No conversations available</option>
        ) : (
          <option value="null">Select Conversation</option>
        )}
        {comparableConversations.map((val) => (
          <option key={val.id} value={val.id}>
            {val.name}
          </option>
        ))}
      </select>
    </div>
  );
};
