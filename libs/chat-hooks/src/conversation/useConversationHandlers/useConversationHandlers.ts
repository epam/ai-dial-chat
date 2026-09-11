import type {
  ConversationResponseDto,
  ConversationsApi,
  FilesApi,
  RateApi,
  SendCompletionDtoModeEnum,
} from '@epam/ai-dial-chat-api-client';
import { SendCompletionDtoModeEnum as CompletionMode } from '@epam/ai-dial-chat-api-client';
import {
  type Attachment,
  type Conversation,
  type DisplayAttachment,
  generateUUID,
  type MessageCustomContent,
  MessageRating,
  MessageRole,
  type RequestSkill,
  type StarterOption,
  type UploadedAttachmentResult,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useState } from 'react';
import { useAttachmentUpload } from '../useAttachmentUpload/useAttachmentUpload';
import { getConversationPath } from '../useConversationStream/conversation-path';
import type { ConversationStateAccessor } from '../useConversationStream/useConversationStream';
import { attachmentsToDtos } from './attachment-to-dto';
import { createMessagePair } from './message-factory';
import {
  hasActiveToolConfig,
  shouldRerunGenerationOnEdit,
} from './message-utils';
import { getStarterSubmitText } from './starter-option';

/** The exact `startStream` shape `useConversationStream` returns. */
export type ConversationStreamStarter = (
  conversationPath: string,
  userContent: string,
  messageIndex: number,
  model: string,
  customContent?: MessageCustomContent,
  generationId?: string,
  mode?: SendCompletionDtoModeEnum,
) => void;

/** Parameters for {@link useConversationHandlers}. */
export interface UseConversationHandlersParams {
  conversation: Conversation | null;
  conversationId: string | undefined;
  bucket: string | undefined;
  isStreaming: boolean;
  /** The `startStream` function returned by `useConversationStream`. */
  startStream: ConversationStreamStarter;
  /** Shared mutable channel for the displayed conversation — the same one passed to `useConversationStream`. */
  state: ConversationStateAccessor;
  /** Already-configured generated-client instance used to upload attachments. */
  filesApi: Pick<FilesApi, 'uploadFile'>;
  /** Already-configured generated-client instance used to save/delete the conversation. */
  conversationsApi: Pick<
    ConversationsApi,
    'saveConversation' | 'deleteConversation'
  >;
  /** Already-configured generated-client instance used to rate a message. */
  rateApi: Pick<RateApi, 'rateMessage'>;
  /** Resolves the model id to send with the next completion. Re-evaluated on every call — never cached. */
  resolveModelId: () => string;
  /** Called when deleting the last message also deletes the whole conversation. */
  onConversationDeleted?: () => void;
  /** Called with batched filenames after a burst of network-error upload failures. */
  showNetworkError?: (filenames: string[]) => void;
  /** Tool toggle configuration values merged into every outgoing completion request. */
  toolConfigurationValue?: Record<string, boolean>;
}

/** Return value of {@link useConversationHandlers}. */
export interface UseConversationHandlersResult {
  handleSend: (
    message: string,
    attachments: Attachment[],
    skills?: RequestSkill[],
  ) => Promise<void>;
  handleUploadAttachment: (
    attachment: Attachment,
  ) => Promise<UploadedAttachmentResult>;
  handleRegenerateMessage: (messageIndex: number) => void;
  handleDeleteMessage: (messageIndex: number) => void;
  handleConfirmDelete: () => void;
  handleRateMessage: (
    messageIndex: number,
    rating: MessageRating | null,
    comment?: string,
  ) => Promise<boolean>;
  handleButtonSelect: (
    starter: StarterOption,
    propertyKey?: string,
    description?: string,
  ) => void;
  handleConfirmStarter: () => void;
  handleStartEdit: (messageIndex: number) => void;
  handleCancelEdit: (messageIndex: number) => void;
  handleEditMessage: (
    messageIndex: number,
    text: string,
    keptDisplayAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
    skills?: RequestSkill[],
  ) => Promise<void>;
  editingMessageIndexes: Set<number>;
  pendingDeleteIndex: number | null;
  setPendingDeleteIndex: (index: number | null) => void;
  pendingStarterContext: {
    starter: StarterOption;
    propertyKey?: string;
    description?: string;
  } | null;
  setPendingStarterContext: (
    context: {
      starter: StarterOption;
      propertyKey?: string;
      description?: string;
    } | null,
  ) => void;
}

/**
 * Composes send/regenerate/edit/delete/rate/starter-submission orchestration
 * on top of the library's own `useAttachmentUpload` and the injected
 * `startStream` (from `useConversationStream`). Optimistic message-pair
 * insertion, delete confirmation, and rate revert-on-failure all mutate the
 * shared `state` channel directly, in lockstep with the streaming hook.
 */
export const useConversationHandlers = ({
  conversation,
  conversationId,
  bucket,
  isStreaming,
  startStream,
  state: { setConversation, conversationRef },
  filesApi,
  conversationsApi,
  rateApi,
  resolveModelId,
  onConversationDeleted,
  showNetworkError,
  toolConfigurationValue,
}: UseConversationHandlersParams): UseConversationHandlersResult => {
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

  const { handleUploadAttachment } = useAttachmentUpload({
    filesApi,
    bucket,
    onNetworkError: showNetworkError,
  });

  const handleSend = useCallback(
    async (
      message: string,
      attachments: Attachment[],
      skills?: RequestSkill[],
    ) => {
      if (!conversationId || !conversation) return;

      const attachmentDtos = attachmentsToDtos(attachments);
      const hasToolConfig = hasActiveToolConfig(toolConfigurationValue);
      const customContent: MessageCustomContent | undefined =
        attachmentDtos?.length || hasToolConfig || skills?.length
          ? {
              ...(attachmentDtos?.length
                ? { attachments: attachmentDtos }
                : {}),
              ...(hasToolConfig
                ? { configuration_value: toolConfigurationValue }
                : {}),
              ...(skills?.length ? { skills } : {}),
            }
          : undefined;
      const modelId = resolveModelId();
      const { userMessage, assistantMessage } = createMessagePair(
        message,
        customContent,
        modelId,
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
        modelId,
        customContent,
        generateUUID(),
        CompletionMode.Append,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      resolveModelId,
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

      const modelId = resolveModelId();

      setConversation((prev) => {
        if (!prev) return prev;
        const regeneratedMessage = {
          ...prev.messages[messageIndex],
          content: '',
          custom_content: undefined,
          wasStoppedByUser: undefined,
          stoppedWithoutContent: undefined,
          streamErrorMessage: undefined,
          deploymentId: modelId,
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
        modelId,
        userMsg.custom_content,
        generateUUID(),
        CompletionMode.Regenerate,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      isStreaming,
      resolveModelId,
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
    const idx = pendingDeleteIndex;
    setPendingDeleteIndex(null);

    const prev = conversationRef.current;
    if (!prev || idx === -1) return;

    const conversationPath = getConversationPath(conversationId);
    const next =
      prev.messages[idx + 1]?.role === MessageRole.Assistant
        ? prev.messages.filter((_, i) => i !== idx && i !== idx + 1)
        : prev.messages.filter((_, i) => i !== idx);

    if (
      next.length === 0 ||
      (next.length === 1 && next[0].role === MessageRole.Status)
    ) {
      void conversationsApi.deleteConversation({ path: conversationPath });
      onConversationDeleted?.();
      return;
    }

    const updated = { ...prev, messages: next };
    conversationRef.current = updated;
    setConversation(updated);
    void conversationsApi.saveConversation({
      path: conversationPath,
      saveConversationBodyDto: {
        conversation: updated as unknown as ConversationResponseDto,
      },
    });
  }, [
    conversationId,
    conversationRef,
    conversationsApi,
    onConversationDeleted,
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

      const persist = () =>
        conversationsApi.saveConversation({
          path: conversationPath,
          saveConversationBodyDto: {
            conversation:
              updatedConversation as unknown as ConversationResponseDto,
          },
        });

      if (rating != null) {
        const responseId = msg.responseId;
        if (!responseId) {
          revert();
          return false;
        }
        try {
          await rateApi.rateMessage({
            rateMessageDto: {
              conversationId: conversation.id,
              responseId,
              modelId: conversation.model.id,
              rate: rating,
              ...(comment ? { comment } : {}),
            },
          });
          await persist();
          return true;
        } catch {
          revert();
          return false;
        }
      } else {
        try {
          await persist();
          return true;
        } catch {
          revert();
          return false;
        }
      }
    },
    [
      conversation,
      conversationId,
      conversationRef,
      conversationsApi,
      rateApi,
      setConversation,
    ],
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

      const modelId = resolveModelId();
      const { userMessage, assistantMessage } = createMessagePair(
        displayText,
        customContent,
        modelId,
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
       * Active tool config must always be forwarded so the completion
       * endpoint can apply it regardless of how the starter was triggered. */
      startStream(
        conversationId,
        submitText,
        conversation.messages.length + 1,
        modelId,
        customContent,
        generateUUID(),
        CompletionMode.Append,
      );
    },
    [
      conversation,
      conversationId,
      conversationRef,
      resolveModelId,
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
      skills?: RequestSkill[],
    ) => {
      if (isStreaming || !conversationId || !conversation) return;

      const idx = messageIndex;
      if (idx === -1 || conversation.messages[idx].role !== MessageRole.User)
        return;

      const originalMessage = conversation.messages[idx];

      if (
        !shouldRerunGenerationOnEdit(
          conversation.messages,
          idx,
          text,
          keptDisplayAttachments,
          newAttachments,
          skills,
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

      const {
        attachments: _removed,
        skills: originalSkills,
        ...restCustomContent
      } = originalMessage.custom_content ?? {};
      /*
       * `skills` semantics: `undefined` preserves the message's original
       * skills untouched (the host leaves them alone — e.g. an edit made
       * while the feature flag is off), while an array — including an empty
       * one — is the skill state the edit UI resolved and replaces them
       * (empty means the user removed the skill).
       */
      const nextSkills = skills ?? originalSkills;

      let updatedCustomContent: MessageCustomContent | undefined;
      if (allAttachments.length > 0 || nextSkills?.length) {
        updatedCustomContent = {
          ...restCustomContent,
          ...(allAttachments.length > 0 ? { attachments: allAttachments } : {}),
          ...(nextSkills?.length ? { skills: nextSkills } : {}),
        };
      } else if (Object.keys(restCustomContent).length > 0) {
        updatedCustomContent = restCustomContent;
      } else {
        updatedCustomContent = undefined;
      }

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

      /* The ref is assigned outside the updater because startStream reads it
       * synchronously below to seed its live-message buffer: React may defer a
       * function updater to the next render, which would seed the buffer with
       * the answer this edit replaces. */
      conversationRef.current = updated;
      setConversation(updated);

      const modelId = resolveModelId();

      // Backend will save the conversation at stream start; no pre-save needed.
      startStream(
        conversationId,
        text,
        updatedMessages.length - 1,
        modelId,
        updatedCustomContent,
        generateUUID(),
        CompletionMode.Edit,
      );

      setEditingMessageIndexes(new Set());
    },
    [
      conversation,
      conversationId,
      conversationRef,
      isStreaming,
      resolveModelId,
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
