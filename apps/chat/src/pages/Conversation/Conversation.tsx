import {
  Attachment,
  Conversation,
  Message,
  MessageCustomContent,
  MessageRole,
  type MessageRating,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
  DialNotification,
  NotificationVariant,
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
import { useDeployments } from '../../context/DeploymentsContext.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import { useModelChangeEffect } from '../../hooks/useModelChangeEffect.js';
import { streamCompletion } from '../../server-api/chat-stream.api';
import {
  deleteConversation as apiDeleteConversation,
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { rateMessage } from '../../server-api/rate.api';
import { applyChunkToMessages } from '../../utils/apply-chunk';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { createMessagePair } from '../../utils/message-factory';
import { getStarterPopulateText } from '../../utils/starter-option';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [hasStreamError, setHasStreamError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { selectedItemId } = useDeployments();
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
        saveConversation(conversationPath, next).catch(() => {
          // status message remains in local state even if persist fails
        });
        return next;
      });
    },
    [conversationId],
  );

  useModelChangeEffect(conversationId, addStatusMessage);

  const startStream = useCallback(
    (
      conversationPath: string,
      userContent: string,
      assistantMessageId: string,
      model: string,
      customContent?: MessageCustomContent,
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      streamCompletion(
        conversationPath,
        userContent,
        model,
        {
          signal: controller.signal,
          onChunk: (chunk) => {
            setConversation((prev) => {
              if (!prev) return prev;
              const updatedMessages = applyChunkToMessages(
                prev.messages,
                assistantMessageId,
                chunk,
              );
              if (!updatedMessages) return prev;
              const next = { ...prev, messages: updatedMessages };
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
            setHasStreamError(true);
          },
        },
        customContent,
      );
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
            lastMsg.custom_content,
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
            i === idx ? { ...m, content: '', custom_content: undefined } : m,
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
        userMsg.custom_content,
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

      if (next.length === 0) {
        apiDeleteConversation(conversationPath);
        navigate(ROUTES.ROOT);
        return prev;
      }

      const updated = { ...prev, messages: next };
      conversationRef.current = updated;
      saveConversation(conversationPath, updated);
      return updated;
    });
  }, [conversationId, navigate, pendingDeleteId]);

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

  const submitStarter = useCallback(
    (starter: StarterOption, propertyKey?: string, description?: string) => {
      if (!conversationId || !conversation) return;

      const text = description ?? getStarterPopulateText(starter);
      const configurationValue = propertyKey
        ? { [propertyKey]: starter.const }
        : undefined;

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(
          text,
          undefined,
          configurationValue,
          selectedItemId ?? undefined,
        );

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
        text,
        assistantMessageId,
        conversation.model.id,
        configurationValue
          ? {
              form_value: configurationValue,
            }
          : undefined,
      );
    },
    [conversation, conversationId, selectedItemId, startStream],
  );

  const [pendingStarterContext, setPendingStarterContext] = useState<{
    starter: StarterOption;
    propertyKey?: string;
    description?: string;
  } | null>(null);

  const handleButtonSelect = useCallback(
    (starter: StarterOption, propertyKey?: string, description?: string) => {
      if (!conversationId || !conversation || isStreaming) return;

      if (starter['dial:widgetOptions'].confirmationMessage) {
        setPendingStarterContext({ starter, propertyKey, description });
      } else {
        submitStarter(starter, propertyKey, description);
      }
    },
    [conversation, conversationId, isStreaming, submitStarter],
  );

  const handleConfirmStarter = useCallback(() => {
    if (!pendingStarterContext) return;

    const { starter, propertyKey, description } = pendingStarterContext;
    setPendingStarterContext(null);
    submitStarter(starter, propertyKey, description);
  }, [pendingStarterContext, submitStarter]);

  const handleSend = useCallback(
    async (message: string, attachments: Attachment[]) => {
      if (!conversationId || !conversation) return;

      const attachmentDtos = await attachmentsToDtos(attachments);

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(
          message,
          attachmentDtos,
          undefined,
          selectedItemId ?? undefined,
        );

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
        { attachments: attachmentDtos },
      );
    },
    [conversation, conversationId, selectedItemId, startStream],
  );

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
