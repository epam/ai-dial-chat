import { Conversation, Message, MessageRole } from '@epam/ai-dial-chat-shared';
import {
  AlertVariant,
  ConfirmationPopupVariant,
  DialAlert,
  DialConfirmationPopup,
} from '@epam/ai-dial-ui-kit';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { streamCompletion } from '../../server-api/chat-stream.api';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { createMessagePair } from '../../utils/message-factory';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const startStream = useCallback(
    (
      conversationPath: string,
      userContent: string,
      assistantMessageId: string,
      model: string,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      streamCompletion(conversationPath, userContent, model, {
        signal: controller.signal,
        onChunk: (chunk) => {
          const token = chunk.choices[0]?.delta?.content ?? '';
          if (!token) return;
          setConversation((prev) => {
            if (!prev) return prev;
            const next = {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: m.content + token }
                  : m,
              ),
            };
            conversationRef.current = next;
            return next;
          });
        },
        onComplete: () => {
          setIsStreaming(false);
          abortRef.current = null;
          const final = conversationRef.current;
          if (final) {
            saveConversation(conversationPath, final).catch(
              (err: unknown) => void err,
            );
          }
        },
        onError: () => {
          setIsStreaming(false);
          abortRef.current = null;
        },
      });
    },
    [],
  );

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }

    const conversationPath = conversationId.substring(
      conversationId.indexOf('/') + 1,
    );
    setIsFetching(true);
    apiGetConversation(conversationPath)
      .then((dto) => {
        const result = dto as unknown as Conversation;
        const lastMsg = result.messages[result.messages.length - 1];

        if (lastMsg?.role === MessageRole.User) {
          // First message is saved but unanswered — add assistant placeholder and auto-stream.
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
          );
        } else {
          setConversation(result);
        }
      })
      .catch(() => navigate(ROUTES.ROOT))
      .finally(() => setIsFetching(false));
  }, [conversationId, navigate, startStream]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const handleRegenerateMessage = useCallback(
    (messageId: string) => {
      if (isStreaming || !conversationId || !conversation) return;

      const idx = conversation.messages.findIndex((m) => m.id === messageId);
      if (
        idx === -1 ||
        conversation.messages[idx].role !== MessageRole.Assistant
      )
        return;

      const userMsg = conversation.messages[idx - 1];
      if (!userMsg || userMsg.role !== MessageRole.User) return;

      const conversationPath = conversationId.substring(
        conversationId.indexOf('/') + 1,
      );

      setConversation((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          messages: prev.messages.map((m, i) =>
            i === idx ? { ...m, content: '' } : m,
          ),
        };
        conversationRef.current = next;
        return next;
      });

      startStream(
        conversationPath,
        userMsg.content,
        messageId,
        conversation.model.id,
      );
    },
    [conversation, conversationId, isStreaming, startStream],
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (isStreaming) return;
      setPendingDeleteId(messageId);
    },
    [isStreaming],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!conversationId || !pendingDeleteId) return;
    setPendingDeleteId(null);

    const conversationPath = conversationId.substring(
      conversationId.indexOf('/') + 1,
    );

    setConversation((prev) => {
      if (!prev) return prev;
      const idx = prev.messages.findIndex((m) => m.id === pendingDeleteId);
      if (idx === -1) return prev;

      const next =
        prev.messages[idx + 1]?.role === MessageRole.Assistant
          ? prev.messages.filter((_, i) => i !== idx && i !== idx + 1)
          : prev.messages.filter((_, i) => i !== idx);

      const updated = { ...prev, messages: next };
      conversationRef.current = updated;
      saveConversation(conversationPath, updated).catch(() =>
        setDeleteError(true),
      );
      return updated;
    });
  }, [conversationId, pendingDeleteId]);

  const handleSend = useCallback(
    (message: string) => {
      if (!conversationId || !conversation) return;

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(message);

      const conversationPath = conversationId.substring(
        conversationId.indexOf('/') + 1,
      );

      setConversation((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          messages: [...prev.messages, userMessage, assistantMessage],
        };
        conversationRef.current = next;
        return next;
      });

      startStream(
        conversationPath,
        message,
        assistantMessageId,
        conversation.model.id,
      );
    },
    [conversation, conversationId, startStream],
  );

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        {deleteError && (
          <div className="absolute left-1/2 top-4 z-50 w-[400px] -translate-x-1/2">
            <DialAlert
              variant={AlertVariant.Error}
              message={t(ChatI18nKeys.DeleteMessageError)}
              closable
              onClose={() => setDeleteError(false)}
            />
          </div>
        )}
        <ConversationView
          messages={conversation.messages}
          onSend={handleSend}
          onStop={handleStop}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          isAssistantTyping={isStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
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
    </>
  );
};
