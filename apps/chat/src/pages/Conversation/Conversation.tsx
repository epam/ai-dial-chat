import {
  type Conversation,
  type Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
  DialNotification,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { FC, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import { useConversationHandlers } from '../../hooks/conversation/useConversationHandlers';
import { useConversationStream } from '../../hooks/conversation/useConversationStream';
import { getConversation as apiGetConversation } from '../../server-api/conversations.api';
import { getConversationPath } from '../../utils/conversation-path';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { handleClose: handleCloseSourcesSidebar, setMessages } =
    useSourcesSidebar();

  useEffect(() => {
    setMessages(conversation?.messages ?? []);
    return () => handleCloseSourcesSidebar();
  }, [handleCloseSourcesSidebar, conversation?.messages, setMessages]);

  const {
    startStream,
    handleStop,
    isStreaming,
    hasStreamError,
    setHasStreamError,
  } = useConversationStream({
    conversationId,
    stoppedGeneratingText: t(ChatI18nKeys.StoppedGenerating),
    setConversation,
    conversationRef,
  });

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }

    const conversationPath = getConversationPath(conversationId);
    setIsFetching(true);
    apiGetConversation(conversationPath)
      .then((dto) => {
        const result = dto as unknown as Conversation;
        const lastMsg = result.messages[result.messages.length - 1];

        if (lastMsg?.role === MessageRole.User) {
          // Unanswered user message on load — add placeholder and auto-stream.
          const assistantMessageId = `stream_${Date.now()}`;
          const assistantPlaceholder: Message = {
            id: assistantMessageId,
            role: MessageRole.Assistant,
            content: '',
            timestamp: new Date().toISOString(),
          };
          const withPlaceholder = {
            ...result,
            messages: [...result.messages, assistantPlaceholder],
          };
          setConversation(withPlaceholder);
          conversationRef.current = withPlaceholder;
          startStream(
            conversationPath,
            lastMsg.content,
            assistantMessageId,
            result.model.id,
            lastMsg.custom_content,
          );
        } else {
          setConversation(result);
        }
      })
      .catch(() => navigate(ROUTES.ROOT))
      .finally(() => setIsFetching(false));
  }, [conversationId, navigate, startStream]);

  const {
    handleSend,
    handleRegenerateMessage,
    handleDeleteMessage,
    handleConfirmDelete,
    handleRateMessage,
    handleButtonSelect,
    handleConfirmStarter,
    handleStartEdit,
    handleCancelEdit,
    handleEditMessage,
    editingMessageIds,
    pendingDeleteId,
    setPendingDeleteId,
    pendingStarterContext,
    setPendingStarterContext,
  } = useConversationHandlers({
    conversation,
    conversationId,
    isStreaming,
    startStream,
    conversationRef,
    setConversation,
    navigate,
  });

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        {hasStreamError && (
          <div className="absolute left-1/2 top-4 z-50 w-[400px] -translate-x-1/2">
            <DialNotification
              variant={NotificationVariant.Error}
              message={t(ChatI18nKeys.StreamError)}
              closable
              onClose={() => setHasStreamError(false)}
            />
          </div>
        )}
        <ConversationView
          messages={conversation.messages}
          onSend={handleSend}
          onStop={handleStop}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onRateMessage={handleRateMessage}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onEditMessage={handleEditMessage}
          editingMessageIds={editingMessageIds}
          isAssistantTyping={isStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
          onSelectStarter={handleButtonSelect}
        />
      </div>

      <DialConfirmationPopup
        open={!!pendingDeleteId}
        header={t(ChatI18nKeys.DeleteMessageTitle)}
        description={t(ChatI18nKeys.DeleteMessageDescription)}
        confirmLabel={t(ActionsI18nKeys.Delete)}
        cancelLabel={t(ActionsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDeleteId(null)}
      />

      <DialConfirmationPopup
        open={!!pendingStarterContext}
        header={t(ChatI18nKeys.StarterConfirmTitle)}
        description={
          pendingStarterContext?.starter['dial:widgetOptions']
            .confirmationMessage ?? ''
        }
        confirmLabel={t(ActionsI18nKeys.Confirm)}
        cancelLabel={t(ActionsI18nKeys.Cancel)}
        onConfirm={handleConfirmStarter}
        onClose={() => setPendingStarterContext(null)}
      />
    </>
  );
};
