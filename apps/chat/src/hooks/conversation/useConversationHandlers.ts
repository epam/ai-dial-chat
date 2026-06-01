import {
  type Attachment,
  type Conversation,
  type MessageCustomContent,
  MessageRating,
  MessageRole,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';
import { type NavigateFunction } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import {
  deleteConversation as apiDeleteConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { rateMessage } from '../../server-api/rate.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { createMessagePair } from '../../utils/message-factory';
import { getStarterPopulateText } from '../../utils/starter-option';

interface Params {
  conversation: Conversation | null;
  conversationId: string | undefined;
  isStreaming: boolean;
  startStream: (
    conversationPath: string,
    userContent: string,
    assistantMessageId: string,
    model: string,
    customContent?: MessageCustomContent,
  ) => void;
  conversationRef: MutableRefObject<Conversation | null>;
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  navigate: NavigateFunction;
}

export const useConversationHandlers = ({
  conversation,
  conversationId,
  isStreaming,
  startStream,
  conversationRef,
  setConversation,
  navigate,
}: Params) => {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingStarterContext, setPendingStarterContext] = useState<{
    starter: StarterOption;
    propertyKey?: string;
    description?: string;
  } | null>(null);

  const handleSend = useCallback(
    async (message: string, attachments: Attachment[]) => {
      if (!conversationId || !conversation) return;

      const attachmentDtos = await attachmentsToDtos(attachments);
      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(message, attachmentDtos);
      const conversationPath = getConversationPath(conversationId);

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
        {
          attachments: attachmentDtos,
        },
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      setConversation,
      startStream,
    ],
  );

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

      const conversationPath = getConversationPath(conversationId);

      setConversation((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          messages: prev.messages.map((m, i) =>
            i === idx
              ? {
                  ...m,
                  content: '',
                  custom_content: undefined,
                  wasStoppedByUser: undefined,
                  stoppedWithoutContent: undefined,
                  hasStreamError: undefined,
                }
              : m,
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
    [
      conversation,
      conversationId,
      conversationRef,
      isStreaming,
      setConversation,
      startStream,
    ],
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

    const conversationPath = getConversationPath(conversationId);

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
  }, [
    conversationId,
    conversationRef,
    navigate,
    pendingDeleteId,
    setConversation,
  ]);

  const handleRateMessage = useCallback(
    async (messageId: string, rating: MessageRating | null) => {
      if (!conversationId) return;

      let previousRating: MessageRating | undefined;
      setConversation((prev) => {
        if (!prev) return prev;
        const msg = prev.messages.find((m) => m.id === messageId);
        if (!msg) return prev;
        previousRating = msg.rating;
        const next: Conversation = {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === messageId ? { ...m, rating: rating ?? undefined } : m,
          ),
        };
        conversationRef.current = next;
        return next;
      });

      const updated = conversationRef.current;
      if (!updated) return;

      const conversationPath = getConversationPath(conversationId);

      if (rating !== null) {
        try {
          await rateMessage({
            conversationId: updated.id,
            responseId: messageId,
            modelId: updated.model.id,
            rate: rating,
          });
          await saveConversation(conversationPath, updated);
        } catch {
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
        await saveConversation(conversationPath, updated).catch(() => {
          setConversation((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === messageId ? { ...m, rating: previousRating } : m,
              ),
            };
          });
        });
      }
    },
    [conversationId, conversationRef, setConversation],
  );

  const submitStarter = useCallback(
    (starter: StarterOption, propertyKey?: string, description?: string) => {
      if (!conversationId || !conversation) return;

      const text = description ?? getStarterPopulateText(starter);
      const configurationValue = propertyKey
        ? { [propertyKey]: starter.const }
        : undefined;

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(text, undefined, configurationValue);
      const conversationPath = getConversationPath(conversationId);

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
        configurationValue ? { form_value: configurationValue } : undefined,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      setConversation,
      startStream,
    ],
  );

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

  return {
    handleSend,
    handleRegenerateMessage,
    handleDeleteMessage,
    handleConfirmDelete,
    handleRateMessage,
    handleButtonSelect,
    handleConfirmStarter,
    pendingDeleteId,
    setPendingDeleteId,
    pendingStarterContext,
    setPendingStarterContext,
  };
};
