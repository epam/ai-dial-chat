import { FC, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConversation } from '../../context/ConversationContext';
import ConversationView from '../ConversationView/ConversationView';

export interface ConversationPageProps {}

export const ConversationPage: FC<ConversationPageProps> = memo(() => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { conversations, sendMessage } = useConversation();
  const { t } = useTranslation();

  const conversation = conversationId
    ? conversations.get(conversationId)
    : undefined;

  const handleSend = useCallback(
    (message: string) => {
      if (conversationId) {
        sendMessage(conversationId, message);
      }
    },
    [conversationId, sendMessage],
  );

  if (!conversation) {
    return (
      <div
        className="flex h-full items-center justify-center"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-gray-500 dark:text-gray-400">
          Conversation not found.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ConversationView
        messages={conversation.messages}
        onSend={handleSend}
        placeholder={t('chat.placeholder')}
      />
    </div>
  );
});

ConversationPage.displayName = 'ConversationPage';
