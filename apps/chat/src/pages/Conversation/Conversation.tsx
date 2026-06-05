import {
  type Conversation,
  type Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
} from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import { useConversationHandlers } from '../../hooks/conversation/useConversationHandlers';
import { useConversationStream } from '../../hooks/conversation/useConversationStream';
import { useDeploymentChangeEffect } from '../../hooks/useDeploymentChangeEffect.js';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { getConversationPath } from '../../utils/conversation-path';
import { getLastDeploymentId } from '../../utils/message-utils';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setSelectedItemId } = useDeployments();
  const { handleClose: handleCloseSourcesSidebar, setMessages } =
    useSourcesSidebar();

  useEffect(() => {
    setMessages(conversation?.messages ?? []);
    return () => handleCloseSourcesSidebar();
  }, [handleCloseSourcesSidebar, conversation?.messages, setMessages]);

  const addStatusMessage = useCallback(
    (msg: Message) => {
      if (!conversationId) return;
      const conversationPath = conversationId.substring(
        conversationId.indexOf('/') + 1,
      );
      setConversation((prev) => {
        if (!prev) return prev;
        const next = { ...prev, messages: [...prev.messages, msg] };
        conversationRef.current = next;
        saveConversation(
          conversationPath,
          next as ConversationResponseDto,
        ).catch(() => {
          // status message remains in local state even if persist fails
        });
        return next;
      });
    },
    [conversationId],
  );

  const isConversationLoaded = !isFetching && !!conversation;
  useDeploymentChangeEffect(
    conversationId,
    addStatusMessage,
    isConversationLoaded,
  );

  const { startStream, handleStop, isStreaming } = useConversationStream({
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

        // Restore the last selected agent from the conversation's change history
        // so the deployment selector reflects what was active, not the default.
        const lastDeploymentId = getLastDeploymentId(result.messages);
        if (lastDeploymentId) {
          setSelectedItemId(lastDeploymentId);
        }

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
  }, [conversationId, navigate, setSelectedItemId, startStream]);

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
        <ConversationView
          messages={conversation.messages}
          initialModelId={conversation.assistantModelId}
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
          streamErrorText={t(ChatI18nKeys.StreamError)}
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
