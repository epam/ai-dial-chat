import type { Conversation } from '@epam/ai-dial-chat-shared';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { type MutableRefObject, useEffect } from 'react';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { saveConversation } from '../../server-api/conversations.api';
import { getConversationPath } from '../../utils/conversation-path';
import { toOverlayMessages } from '../../utils/overlay-messages';

interface Params {
  conversation: Conversation | null;
  conversationId: string | undefined;
  conversationRef: MutableRefObject<Conversation | null>;
  setConversation: (conversation: Conversation) => void;
  handleSend: (message: string, attachments: never[]) => Promise<void> | void;
  setOverlayInputContent: (content: string) => void;
}

/**
 * Registers `ConversationPage`'s local conversation state as the overlay's
 * active-conversation bridge, re-registering on every change to `conversation`
 * or `conversationId` and unregistering on unmount. No-op outside overlay mode.
 */
export const useActiveConversationBridge = ({
  conversation,
  conversationId,
  conversationRef,
  setConversation,
  handleSend,
  setOverlayInputContent,
}: Params): void => {
  const overlay = useOptionalOverlay();

  useEffect(() => {
    if (!overlay) return;

    /*
     * Loading an existing conversation updates React state before any user
     * action updates the mutable ref. Keep the bridge's live source in sync so
     * its first request sees the loaded history and settings.
     */
    conversationRef.current = conversation;

    overlay.registerActiveConversationBridge(
      {
        getMessages: () => ({
          messages: toOverlayMessages(conversationRef.current?.messages ?? []),
        }),
        sendMessage: async (content) => {
          await handleSend(content, []);
          return {
            messages: toOverlayMessages(
              conversationRef.current?.messages ?? [],
            ),
          };
        },
        setInputContent: (content) => {
          setOverlayInputContent(content);
        },
        setSystemPrompt: async (systemPrompt) => {
          const current = conversationRef.current;
          if (!current || !conversationId) return { systemPrompt };
          const updated = { ...current, prompt: systemPrompt };
          setConversation(updated);
          conversationRef.current = updated;
          await saveConversation(
            getConversationPath(conversationId),
            updated as ConversationResponseDto,
          );
          return { systemPrompt };
        },
        setTemperature: async (temperature) => {
          const current = conversationRef.current;
          if (!current || !conversationId) return { temperature };
          const updated = { ...current, temperature };
          setConversation(updated);
          conversationRef.current = updated;
          await saveConversation(
            getConversationPath(conversationId),
            updated as ConversationResponseDto,
          );
          return { temperature };
        },
      },
      conversationId ?? null,
    );
    return () => overlay.registerActiveConversationBridge(null, null);
    // conversationRef is a stable ref — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    overlay,
    conversation,
    conversationId,
    handleSend,
    setConversation,
    setOverlayInputContent,
  ]);
};
