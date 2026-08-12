import type {
  ConversationResponseDto,
  SendCompletionDtoModeEnum,
} from '@epam/ai-dial-chat-api-client';
import {
  type Attachment,
  type Conversation,
  type DisplayAttachment,
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
import { type NavigateFunction } from 'react-router';
import { useDeployments } from '../../context/DeploymentsContext';
import { CompletionMode } from '../../server-api/chat-stream.api';
import {
  deleteConversation as apiDeleteConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { rateMessage } from '../../server-api/rate.api';
import { ROUTES } from '../../types/routes';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { createMessagePair } from '../../utils/message-factory';
import {
  hasActiveToolConfig,
  isMessageChanged,
} from '../../utils/message-utils';
import { getStarterSubmitText } from '../../utils/starter-option';
import { useAttachmentUpload } from './useAttachmentUpload';

interface Params {
  conversation: Conversation | null;
  conversationId: string | undefined;
  bucket: string;
  isStreaming: boolean;
  startStream: (
    conversationPath: string,
    userContent: string,
    messageIndex: number,
    model: string,
    customContent?: MessageCustomContent,
    generationId?: string,
    mode?: SendCompletionDtoModeEnum,
  ) => void;
  conversationRef: MutableRefObject<Conversation | null>;
  setConversation: Dispatch<SetStateAction<Conversation | null>>;
  navigate: NavigateFunction;
  /** Called with batched filenames after a burst of network-error upload failures. */
  showNetworkError?: (filenames: string[]) => void;
  /** Tool toggle configuration values merged into every outgoing completion request. */
  toolConfigurationValue?: Record<string, boolean>;
  /**
   * When provided, overrides the globally-selected deployment for every
   * message sent through this hook. Used by callers that pin the
   * conversation to a specific model regardless of the user's current
   * deployment selection elsewhere in the app.
   */
  fixedModelId?: string;
}

export const useConversationHandlers = ({
  conversation,
  conversationId,
  bucket,
  isStreaming,
  startStream,
  conversationRef,
  setConversation,
  navigate,
  showNetworkError,
  toolConfigurationValue,
  fixedModelId,
}: Params) => {
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );
  const [editingMessageIndexes, setEditingMessageIndexes] = useState<
    Set<number>
  >(new Set());

  const [pendingStarterContext, setPendingStarterContext] = useState<{
    starter: StarterOption;
    propertyKey?: string;
    description?: string;
  } | null>(null);
  const { selectedItemId: contextSelectedItemId } = useDeployments();
  const selectedItemId = fixedModelId ?? contextSelectedItemId;

  const { handleUploadAttachment } = useAttachmentUpload({
    bucket,
    onNetworkError: showNetworkError,
  });

  const handleSend = useCallback(
    async (message: string, attachments: Attachment[]) => {
      if (!conversationId || !conversation) return;

      const attachmentDtos = attachmentsToDtos(attachments);
      const hasToolConfig = hasActiveToolConfig(toolConfigurationValue);
      const customContent: MessageCustomContent | undefined =
        attachmentDtos?.length || hasToolConfig
          ? {
              ...(attachmentDtos?.length
                ? { attachments: attachmentDtos }
                : {}),
              ...(hasToolConfig
                ? { configuration_value: toolConfigurationValue }
                : {}),
            }
          : undefined;
      const { userMessage, assistantMessage } = createMessagePair(
        message,
        customContent,
        selectedItemId ?? conversation.model.id,
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
        conversationId,
        message,
        conversation.messages.length + 1,
        selectedItemId ?? conversation.model.id,
        customContent,
        crypto.randomUUID(),
        CompletionMode.Append,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      selectedItemId,
      setConversation,
      startStream,
      toolConfigurationValue,
    ],
  );

  const handleRegenerateMessage = useCallback(
    (messageIndex: number) => {
      if (isStreaming || !conversationId || !conversation) return;

      if (
        messageIndex === -1 ||
        conversation.messages[messageIndex]?.role !== MessageRole.Assistant
      )
        return;

      const userMsg = conversation.messages[messageIndex - 1];
      if (!userMsg || userMsg.role !== MessageRole.User) return;

      setConversation((prev) => {
        if (!prev) return prev;
        const regeneratedMessage = {
          ...prev.messages[messageIndex],
          content: '',
          custom_content: undefined,
          wasStoppedByUser: undefined,
          stoppedWithoutContent: undefined,
          streamErrorMessage: undefined,
          deploymentId: selectedItemId ?? conversation.model.id,
        };
        const next = {
          ...prev,
          messages: [
            ...prev.messages.slice(0, messageIndex),
            regeneratedMessage,
          ],
        };
        conversationRef.current = next;
        return next;
      });

      setEditingMessageIndexes(
        (indexes) =>
          new Set([...indexes].filter((index) => index < messageIndex)),
      );

      startStream(
        conversationId,
        userMsg.content,
        messageIndex,
        selectedItemId ?? conversation.model.id,
        userMsg.custom_content,
        crypto.randomUUID(),
        CompletionMode.Regenerate,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      isStreaming,
      selectedItemId,
      setConversation,
      startStream,
    ],
  );

  const handleDeleteMessage = useCallback(
    (messageIndex: number) => {
      if (isStreaming) return;
      setPendingDeleteIndex(messageIndex);
    },
    [isStreaming],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!conversationId || pendingDeleteIndex == null) return;
    setPendingDeleteIndex(null);

    const conversationPath = getConversationPath(conversationId);

    setConversation((prev) => {
      if (!prev) return prev;
      const idx = pendingDeleteIndex;
      if (idx === -1) return prev;

      const next =
        prev.messages[idx + 1]?.role === MessageRole.Assistant
          ? prev.messages.filter((_, i) => i !== idx && i !== idx + 1)
          : prev.messages.filter((_, i) => i !== idx);

      if (
        next.length === 0 ||
        (next.length === 1 && next[0].role === MessageRole.Status)
      ) {
        apiDeleteConversation(conversationPath);
        navigate(ROUTES.Root);
        return prev;
      }

      const updated = { ...prev, messages: next };
      conversationRef.current = updated;
      saveConversation(conversationPath, updated as ConversationResponseDto);
      return updated;
    });
  }, [
    conversationId,
    conversationRef,
    navigate,
    pendingDeleteIndex,
    setConversation,
  ]);

  const handleRateMessage = useCallback(
    async (
      messageIndex: number,
      rating: MessageRating | null,
      comment?: string,
    ): Promise<boolean> => {
      if (!conversationId || !conversation) return false;

      const msg = conversation.messages[messageIndex];
      if (!msg) return false;

      const previousRating = msg.rating;
      const updatedConversation: Conversation = {
        ...conversation,
        messages: conversation.messages.map((m, i) =>
          i === messageIndex ? { ...m, rating: rating ?? undefined } : m,
        ),
      };

      setConversation(() => {
        conversationRef.current = updatedConversation;
        return updatedConversation;
      });

      const conversationPath = getConversationPath(conversationId);

      const revert = () => {
        setConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m, i) =>
              i === messageIndex ? { ...m, rating: previousRating } : m,
            ),
          };
        });
      };

      if (rating != null) {
        const responseId = msg.responseId;
        if (!responseId) {
          revert();
          return false;
        }
        try {
          await rateMessage({
            conversationId: conversation.id,
            responseId,
            modelId: conversation.model.id,
            rate: rating,
            ...(comment ? { comment } : {}),
          });
          await saveConversation(
            conversationPath,
            updatedConversation as ConversationResponseDto,
          );
          return true;
        } catch {
          revert();
          return false;
        }
      } else {
        try {
          await saveConversation(
            conversationPath,
            updatedConversation as ConversationResponseDto,
          );
          return true;
        } catch {
          revert();
          return false;
        }
      }
    },
    [conversation, conversationId, conversationRef, setConversation],
  );

  const submitStarter = useCallback(
    (starter: StarterOption, propertyKey?: string, description?: string) => {
      if (!conversationId || !conversation) return;

      const displayText = description ?? starter.title;
      const submitText = getStarterSubmitText(starter, description);
      const configurationValue = propertyKey
        ? { [propertyKey]: starter.const }
        : undefined;
      const hasToolConfig = hasActiveToolConfig(toolConfigurationValue);

      const customContent: MessageCustomContent | undefined =
        configurationValue || hasToolConfig
          ? {
              ...(configurationValue ? { form_value: configurationValue } : {}),
              ...(hasToolConfig
                ? { configuration_value: toolConfigurationValue }
                : {}),
            }
          : undefined;

      const { userMessage, assistantMessage } = createMessagePair(
        displayText,
        customContent,
        selectedItemId ?? conversation.model.id,
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

      /* `configuration_value` is sent even when `configurationValue` (the
       * form-based starter value) is absent but a tool toggle is active.
       * Unlike the previous code that omitted customContent entirely for
       * non-form starters, active tool config must always be forwarded so
       * the completion endpoint can apply it regardless of how the starter
       * was triggered. */
      startStream(
        conversationId,
        submitText,
        conversation.messages.length + 1,
        selectedItemId ?? conversation.model.id,
        customContent,
        crypto.randomUUID(),
        CompletionMode.Append,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      selectedItemId,
      setConversation,
      startStream,
      toolConfigurationValue,
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

  const handleStartEdit = useCallback((messageIndex: number) => {
    setEditingMessageIndexes((prev) => new Set([...prev, messageIndex]));
  }, []);

  const handleCancelEdit = useCallback((messageIndex: number) => {
    setEditingMessageIndexes((prev) => {
      const next = new Set(prev);
      next.delete(messageIndex);
      return next;
    });
  }, []);

  const handleEditMessage = useCallback(
    async (
      messageIndex: number,
      text: string,
      keptDisplayAttachments: DisplayAttachment[],
      newAttachments: Attachment[],
    ) => {
      if (isStreaming || !conversationId || !conversation) return;

      const idx = messageIndex;
      if (idx === -1 || conversation.messages[idx].role !== MessageRole.User)
        return;

      const originalMessage = conversation.messages[idx];

      if (
        !isMessageChanged(
          originalMessage,
          text,
          keptDisplayAttachments,
          newAttachments,
        )
      ) {
        setEditingMessageIndexes((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
        return;
      }

      const newDtos = attachmentsToDtos(newAttachments);

      const keptIds = new Set(keptDisplayAttachments.map((a) => a.id));
      const keptDtos = (
        originalMessage.custom_content?.attachments ?? []
      ).filter((att) => {
        const id = att.url ?? att.data ?? att.title;
        return keptIds.has(id);
      });

      const allAttachments = [...keptDtos, ...(newDtos ?? [])];

      const { attachments: _removed, ...restCustomContent } =
        originalMessage.custom_content ?? {};
      const updatedCustomContent =
        allAttachments.length > 0
          ? { ...restCustomContent, attachments: allAttachments }
          : Object.keys(restCustomContent).length > 0
            ? restCustomContent
            : undefined;

      const updatedUserMessage = {
        ...originalMessage,
        content: text,
        custom_content: updatedCustomContent,
      };

      const now = Date.now();
      const assistantMessage = {
        role: MessageRole.Assistant,
        content: '',
        timestamp: new Date(now).toISOString(),
      };

      const updatedMessages = [
        ...conversation.messages.slice(0, idx),
        updatedUserMessage,
        assistantMessage,
      ];

      const updated = { ...conversation, messages: updatedMessages };

      setConversation(() => {
        conversationRef.current = updated;
        return updated;
      });

      // Backend will save the conversation at stream start; no pre-save needed.
      startStream(
        conversationId,
        text,
        updatedMessages.length - 1,
        selectedItemId ?? conversation.model.id,
        updatedCustomContent,
        crypto.randomUUID(),
        CompletionMode.Edit,
      );

      setEditingMessageIndexes(new Set());
    },
    [
      conversation,
      conversationId,
      conversationRef,
      isStreaming,
      selectedItemId,
      setConversation,
      startStream,
    ],
  );

  return {
    handleSend,
    handleUploadAttachment,
    handleRegenerateMessage,
    handleDeleteMessage,
    handleConfirmDelete,
    handleRateMessage,
    handleButtonSelect,
    handleConfirmStarter,
    handleStartEdit,
    handleCancelEdit,
    handleEditMessage,
    editingMessageIndexes,
    pendingDeleteIndex,
    setPendingDeleteIndex,
    pendingStarterContext,
    setPendingStarterContext,
  };
};
