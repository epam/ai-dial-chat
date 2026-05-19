import { FC, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import { useConversation } from '../../context/ConversationContext';

const ConversationPage: FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { conversations, sendMessage } = useConversation();
  const navigate = useNavigate();
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
    navigate(ROUTES.ROOT);
    return null;
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
};

export default memo(ConversationPage);
