import {
  Attachment,
  Conversation,
  Message,
  MessageRole,
  Stage,
  type MessageRating,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  AlertVariant,
  ConfirmationPopupVariant,
  DialAlert,
  DialConfirmationPopup,
} from '@epam/ai-dial-ui-kit';
import type { AttachmentDto } from '@epam/chat-api-client';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useModels } from '../../context/ModelsContext';
import { streamCompletion } from '../../server-api/chat-stream.api';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { rateMessage } from '../../server-api/rate.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { createMessagePair } from '../../utils/message-factory';

/**
 * Merges incoming stage updates into the existing accumulated list.
 * Upserts by `index` (replaces matching entry, appends new ones), then sorts ascending.
 */
const mergeStages = (existing: Stage[], incoming: Stage[]): Stage[] => {
  const map = new Map<number, Stage>(existing.map((s) => [s.index, s]));
  for (const stage of incoming) {
    map.set(stage.index, stage);
  }
  return Array.from(map.values()).sort((a, b) => a.index - b.index);
};

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [populateText, setPopulateText] = useState<string | undefined>();
  const [pendingStarter, setPendingStarter] = useState<{
    text: string;
    submit: boolean;
    confirmationMessage: string;
    configurationValue?: Record<string, unknown>;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { selectedModelConfiguration } = useModels();

  const { starters, startersPropertyKey } = useMemo<{
    starters: StarterOption[];
    startersPropertyKey: string | undefined;
  }>(() => {
    const properties = selectedModelConfiguration?.properties;
    const key = properties?.starter
      ? 'starter'
      : properties?.button
        ? 'button'
        : undefined;
    const oneOf = key ? properties?.[key]?.oneOf : undefined;
    if (!Array.isArray(oneOf)) {
      return { starters: [], startersPropertyKey: undefined };
    }
    return { starters: oneOf as StarterOption[], startersPropertyKey: key };
  }, [selectedModelConfiguration]);

  const startStream = useCallback(
    (
      conversationPath: string,
      userContent: string,
      assistantMessageId: string,
      model: string,
      attachments?: AttachmentDto[],
      configurationValue?: Record<string, unknown>,
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
            console.log('Received chunk', chunk);
            const delta = chunk.choices[0]?.delta;
            const content = delta?.content ?? '';
            const incomingStages = delta?.custom_content?.stages;
            if (!content && !incomingStages?.length) return;
            setConversation((prev) => {
              if (!prev) return prev;
              const next = {
                ...prev,
                messages: prev.messages.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const updated: Message = {
                    ...m,
                    content: content ? m.content + content : m.content,
                  };
                  if (incomingStages?.length) {
                    updated.stages = mergeStages(
                      m.stages ?? [],
                      incomingStages,
                    );
                  }
                  return updated;
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
          onError: (e) => {
            console.error('Stream error', e);
            setIsStreaming(false);
            abortRef.current = null;
            setStreamError(true);
          },
        },
        attachments,
        configurationValue,
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
            lastMsg.custom_content?.attachments,
            lastMsg.custom_content?.configuration_value,
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
    async (
      message: string,
      attachments: Attachment[],
      configurationValue?: Record<string, unknown>,
    ) => {
      if (!conversationId || !conversation) return;

      const attachmentDtos = await attachmentsToDtos(attachments);

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(message, attachmentDtos, configurationValue);

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
        attachmentDtos,
        configurationValue,
      );
    },
    [conversation, conversationId, startStream],
  );

  const executeStarter = useCallback(
    (
      text: string,
      submit: boolean,
      configurationValue?: Record<string, unknown>,
    ) => {
      if (submit) {
        void handleSend(text, [], configurationValue);
      } else {
        setPopulateText(text);
      }
    },
    [handleSend],
  );

  const handleStarterSelect = useCallback(
    (
      text: string,
      submit: boolean,
      confirmationMessage: string | null,
      configurationValue?: Record<string, unknown>,
    ) => {
      if (confirmationMessage) {
        setPendingStarter({
          text,
          submit,
          confirmationMessage,
          configurationValue,
        });
      } else {
        executeStarter(text, submit, configurationValue);
      }
    },
    [executeStarter],
  );

  const handleConfirmStarter = useCallback(() => {
    if (pendingStarter) {
      executeStarter(
        pendingStarter.text,
        pendingStarter.submit,
        pendingStarter.configurationValue,
      );
      setPendingStarter(null);
    }
  }, [pendingStarter, executeStarter]);

  const handleCancelStarter = useCallback(() => {
    setPendingStarter(null);
  }, []);

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        {streamError && (
          <div className="absolute left-1/2 top-4 z-50 w-[400px] -translate-x-1/2">
            <DialAlert
              variant={AlertVariant.Error}
              message={t(ChatI18nKeys.StreamError)}
              closable
              onClose={() => setStreamError(false)}
            />
          </div>
        )}
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
          placeholder={t(ChatI18nKeys.Placeholder)}
          starters={starters}
          onStarterSelect={handleStarterSelect}
          populateText={populateText}
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
        open={!!pendingStarter}
        header={t(ChatI18nKeys.StarterConfirmationTitle)}
        description={pendingStarter?.confirmationMessage}
        onConfirm={handleConfirmStarter}
        onCancel={handleCancelStarter}
        onClose={handleCancelStarter}
      />
    </>
  );
};
