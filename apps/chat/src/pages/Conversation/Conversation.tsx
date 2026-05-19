import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useConversation } from '../../context/ConversationContext';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const { conversations, getConversation, sendMessage } = useConversation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Derived from map so it stays reactive to sendMessage updates
  const conversation = conversationId
    ? conversations.get(conversationId)
    : undefined;

  const [isFetching, setIsFetching] = useState(
    !conversation && !!conversationId,
  );

  useEffect(() => {
    if (!conversationId || conversation) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    getConversation(conversationId)
      .then((result) => {
        if (!result) navigate(ROUTES.ROOT);
      })
      .catch(() => navigate(ROUTES.ROOT))
      .finally(() => setIsFetching(false));
  }, [conversationId, conversation, getConversation, navigate]);

  const handleSend = useCallback(
    (message: string) => {
      if (conversationId) {
        sendMessage(conversationId, message);
      }
    },
    [conversationId, sendMessage],
  );

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ConversationView
        messages={conversation.messages}
        onSend={handleSend}
        placeholder={t(ChatI18nKeys.Placeholder)}
      />
    </div>
  );
};
