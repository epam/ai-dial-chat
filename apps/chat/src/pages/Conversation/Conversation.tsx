import { Conversation } from '@epam/ai-dial-chat-shared';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import { ChatI18nKeys } from '../../constants/translation-keys';
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
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }

    const conversationPath = conversationId.substring(
      conversationId.indexOf('/') + 1,
    );
    let cancelled = false;

    const loadConversation = async () => {
      setIsFetching(true);

      try {
        const result = await apiGetConversation(conversationPath);
        if (!cancelled) {
          setConversation(result);
        }
      } catch {
        if (!cancelled) {
          navigate(ROUTES.ROOT);
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId, navigate]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(
    (message: string) => {
      if (!conversationId || !conversation) return;

      const { userMessage, assistantMessage, assistantMessageId } =
        createMessagePair(message);

      setConversation((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          messages: [...prev.messages, userMessage, assistantMessage],
        };
        conversationRef.current = next;
        return next;
      });

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      // Conversation id format: "{bucket}/{conversationPath}" — strip bucket prefix
      const conversationPath = conversationId.substring(
        conversationId.indexOf('/') + 1,
      );
      const model = conversation.model.id;

      streamCompletion(conversationPath, message, model, {
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
      });
    },
    [conversation, conversationId],
  );

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden">
      <ConversationView
        messages={conversation.messages}
        onSend={handleSend}
        isAssistantTyping={isStreaming}
        placeholder={t(ChatI18nKeys.Placeholder)}
      />
    </div>
  );
};
