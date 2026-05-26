import {
  Conversation,
  Message,
  MessageRole,
  type ApiAttachment,
  type MessageRating,
} from '@epam/ai-dial-chat-shared';
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
import { uploadFile } from '../../server-api/files.api';
import { rateMessage } from '../../server-api/rate.api';
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
    ({
      conversationPath,
      userContent,
      assistantMessageId,
      model,
      attachments,
    }: {
      conversationPath: string;
      userContent: string;
      assistantMessageId: string;
      model: string;
      attachments?: ApiAttachment[];
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      streamCompletion({
        path: conversationPath,
        message: userContent,
        model,
        options: {
          signal: controller.signal,
          onChunk: (chunk) => {
            const delta = chunk.choices[0]?.delta;
            const token = delta?.content ?? '';
            const incomingAttachments = delta?.custom_content?.attachments;
            if (!token && !incomingAttachments?.length) return;
            setConversation((prev) => {
              if (!prev) return prev;
              const next = {
                ...prev,
                messages: prev.messages.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  return {
                    ...m,
                    ...(token ? { content: m.content + token } : {}),
                    ...(incomingAttachments?.length
                      ? {
                          custom_content: {
                            attachments: [
                              ...(m.custom_content?.attachments ?? []),
                              ...incomingAttachments,
                            ],
                          },
                        }
                      : {}),
                  };
                }),
              };
              conversationRef.current = next;
              return next;
            });
          },
          onComplete: async () => {
            setIsStreaming(false);
            abortRef.current = null;
            const final = conversationRef.current;
            if (final) {
              try {
                await saveConversation(conversationPath, final);
              } catch (err: unknown) {
                void err;
              }
            }
          },
          onError: () => {
            setIsStreaming(false);
            abortRef.current = null;
          },
        },
        attachments,
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
          startStream({
            conversationPath,
            userContent: lastMsg.content,
            assistantMessageId,
            model: result.model.id,
          });
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

      startStream({
        conversationPath,
        userContent: userMsg.content,
        assistantMessageId: messageId,
        model: conversation.model.id,
      });
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

  const handleRateMessage = useCallback(
    async (messageId: string, rating: MessageRating | null) => {
      if (!conversationId || !conversation) return;
      const msg = conversation.messages.find((m) => m.id === messageId);
      if (!msg) return;

      const previousRating = msg.rating;

      const conversationPath = conversationId.substring(
        conversationId.indexOf('/') + 1,
      );

      // Optimistic update
      const updatedConversation: Conversation = {
        ...conversation,
        messages: conversation.messages.map((m) =>
          m.id === messageId ? { ...m, rating: rating ?? undefined } : m,
        ),
      };
      setConversation(updatedConversation);

      if (rating !== null) {
        try {
          await rateMessage({
            conversationId: conversation.id,
            responseId: messageId,
            modelId: conversation.model.id,
            rate: rating,
          });
          await saveConversation(conversationPath, updatedConversation);
        } catch {
          // Revert optimistic update on failure
          setConversation((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === messageId ? { ...m, rating: previousRating } : m,
              ),
            };
          });
        }
      } else {
        // Rating cleared (toggle off) — persist the removal without calling the rate API
        await saveConversation(conversationPath, updatedConversation).catch(
          () => {
            setConversation((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === messageId ? { ...m, rating: previousRating } : m,
                ),
              };
            });
          },
        );
      }
    },
    [conversation, conversationId],
  );

  const handleSend = useCallback(
    ({
      message,
      attachments,
    }: {
      message: string;
      attachments?: ApiAttachment[];
    }) => {
      if (!conversationId || !conversation) return;

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair({ content: message, attachments });

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

      startStream({
        conversationPath,
        userContent: message,
        assistantMessageId,
        model: conversation.model.id,
        attachments,
      });
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
          onRateMessage={handleRateMessage}
          isAssistantTyping={isStreaming}
          onUploadAttachment={uploadFile}
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
