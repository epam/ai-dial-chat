import {
  Attachment,
  isAudioTranscriptionSupported,
  MessageRating,
  MessageRole,
  type Conversation,
  type Message,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import NegativeFeedbackModal from '../../components/ConversationView/Rate/NegativeFeedbackModal';
import { getConversationRoute } from '../../constants/routes';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  RateI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useConversationHandlers } from '../../hooks/conversation/useConversationHandlers';
import { useConversationStream } from '../../hooks/conversation/useConversationStream';
import { useDeploymentChangeEffect } from '../../hooks/useDeploymentChangeEffect';
import {
  transcribeAudio,
  transcribeAudioWithAsrModel,
} from '../../server-api/chat.api';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { uploadFile } from '../../server-api/files.api';
import { ROUTES } from '../../types/routes';
import { buildUploadPath } from '../../utils/build-upload-path';
import { getConversationPath } from '../../utils/conversation-path';
import { getLastDeploymentId } from '../../utils/message-utils';

interface Props {
  onDuplicateReadonly?: () => void;
}

export const ConversationPage: FC<Props> = ({ onDuplicateReadonly }) => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    config: { asrModelId, transcribeSizeLimitBytes },
  } = useAppConfig();
  const {
    items: deploymentItems,
    restoreSelectedItemId,
    selectedItemId: currentSelectedItemId,
    isLoading: isDeploymentsLoading,
  } = useDeployments();
  const { handleClose: handleCloseSourcesSidebar, setMessages } =
    useSourcesSidebar();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { conversations, duplicateConversation } = useConversations();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const isTranscriptionSupported = useMemo(() => {
    if (asrModelId != null) return true;
    const selected = deploymentItems.find(
      (item) => item.id === currentSelectedItemId,
    );
    return isAudioTranscriptionSupported(selected?.inputAttachmentTypes);
  }, [asrModelId, deploymentItems, currentSelectedItemId]);

  const lastAudioMimeTypeRef = useRef<string>('audio/webm');

  const handleUploadAudio = useCallback(
    async (file: File, contentType: string): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      if (file.size > transcribeSizeLimitBytes) {
        throw new Error(
          `Audio file exceeds the ${transcribeSizeLimitBytes} byte limit`,
        );
      }
      lastAudioMimeTypeRef.current = contentType;
      const response = await uploadFile(
        bucket,
        buildUploadPath({ name: file.name } as Attachment),
        file,
      );
      return response.url;
    },
    [bucket, transcribeSizeLimitBytes],
  );

  const handleTranscribeAudio = useCallback(
    async (audioUrl: string): Promise<string> => {
      const mimeType = lastAudioMimeTypeRef.current;
      if (asrModelId != null) {
        return transcribeAudioWithAsrModel({ audioUrl, mimeType });
      }
      if (!currentSelectedItemId) {
        throw new Error('No model selected');
      }
      return transcribeAudio({
        audioUrl,
        mimeType,
        deployment: currentSelectedItemId,
      });
    },
    [asrModelId, currentSelectedItemId],
  );

  const { showNotification } = useNotification();

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      showNotification({
        variant: NotificationVariant.Error,
        title: t(AttachmentsI18nKeys.NetworkErrorTitle),
        message: (
          <div className="min-w-0 overflow-hidden">
            <span className="whitespace-pre-line">
              {t(AttachmentsI18nKeys.NetworkErrorMessage)}
            </span>
            <ul className="mt-1 max-w-[508px]">
              {filenames.map((name, i) => (
                <li key={i} className="flex items-center gap-1 overflow-hidden">
                  <span className="shrink-0" aria-hidden>
                    •
                  </span>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
      });
    },
    [showNotification, t],
  );

  const [pendingDislikeMessageIndex, setPendingDislikeMessageIndex] = useState<
    number | null
  >(null);

  const isReadOnly = useMemo(() => {
    if (!conversationId) return false;
    const listItem = conversations.find((c) => c.id.includes(conversationId));
    if (listItem) {
      return (
        listItem.isReadonly || listItem.sharedWithMe || listItem.publishedWithMe
      );
    }
    // Fallback: bucket-prefix check when the conversation isn't in the list yet.
    if (!bucket) return false;
    const slashIndex = conversationId.indexOf('/');
    return slashIndex !== -1 && conversationId.slice(0, slashIndex) !== bucket;
  }, [conversationId, bucket, conversations]);

  const handleDuplicateConversation = useCallback(async () => {
    if (!conversationId) return;
    setDuplicateError(null);
    try {
      const newPath = await duplicateConversation(conversationId);
      if (isReadOnly) onDuplicateReadonly?.();
      navigate(getConversationRoute(newPath));
    } catch {
      setDuplicateError(t(ConversationPanelI18nKeys.DuplicateError));
    }
  }, [
    conversationId,
    isReadOnly,
    onDuplicateReadonly,
    duplicateConversation,
    navigate,
    t,
  ]);

  useEffect(() => {
    setMessages(conversation?.messages ?? []);
    return () => {
      handleCloseSourcesSidebar();
      setMessages([]);
    };
  }, [handleCloseSourcesSidebar, conversation?.messages, setMessages]);

  const addStatusMessage = useCallback(
    (msg: Message) => {
      if (!conversationId) return;
      const conversationPath = getConversationPath(conversationId);
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

  const isConversationLoaded =
    !isFetching && !!conversation && !isDeploymentsLoading;
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

  const loadConversation = useCallback(
    async (id: string) => {
      setIsFetching(true);
      try {
        const dto = await apiGetConversation(id);
        const result = dto as Conversation; // adapt if API response shape differs

        // Restore the last selected agent from the conversation's change history
        // so the deployment selector reflects what was active, not the default.
        const lastDeploymentId = getLastDeploymentId(result.messages);
        const modelToSelect =
          lastDeploymentId ?? (result.assistantModelId || result.model.id);
        if (modelToSelect) {
          restoreSelectedItemId(modelToSelect);
        }

        const lastMsg = result.messages[result.messages.length - 1];

        if (lastMsg?.role === MessageRole.User) {
          const assistantPlaceholder: Message = {
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
            id,
            lastMsg.content,
            withPlaceholder.messages.length - 1,
            lastDeploymentId ?? result.model.id,
            lastMsg.custom_content,
          );
        } else {
          setConversation(result);
        }
      } catch {
        navigate(ROUTES.Root);
      } finally {
        setIsFetching(false);
      }
    },
    [navigate, restoreSelectedItemId, startStream],
  );

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }
    void loadConversation(conversationId);
  }, [conversationId, loadConversation]);

  const {
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
  } = useConversationHandlers({
    conversation,
    conversationId,
    bucket,
    isStreaming,
    startStream,
    conversationRef,
    setConversation,
    navigate,
    showNetworkError: handleNetworkUploadError,
  });

  const handleLike = useCallback(
    async (messageIndex: number, rating: MessageRating | null) => {
      const success = await handleRateMessage(messageIndex, rating);
      if (success && rating === MessageRating.Like) {
        showNotification({
          variant: NotificationVariant.Success,
          title: t(RateI18nKeys.LikeToastTitle),
          message: t(RateI18nKeys.LikeToastDescription),
        });
      }
    },
    [handleRateMessage, showNotification, t],
  );

  const handleOpenDislikeModal = useCallback((messageIndex: number) => {
    setPendingDislikeMessageIndex(messageIndex);
  }, []);

  const handleDislikeSubmit = useCallback(
    async (comment: string) => {
      if (pendingDislikeMessageIndex == null) return;
      const index = pendingDislikeMessageIndex;
      setPendingDislikeMessageIndex(null);
      const success = await handleRateMessage(
        index,
        MessageRating.Dislike,
        comment,
      );
      if (success) {
        showNotification({
          variant: NotificationVariant.Success,
          title: t(RateI18nKeys.DislikeToastTitle),
          message: t(RateI18nKeys.DislikeToastDescription),
        });
      }
    },
    [pendingDislikeMessageIndex, handleRateMessage, showNotification, t],
  );

  const handleDislikeModalClose = useCallback(() => {
    setPendingDislikeMessageIndex(null);
  }, []);

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.Root);
    return null;
  }

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        <ConversationView
          messages={conversation.messages}
          initialModelId={
            conversation.assistantModelId || conversation.model.id
          }
          onSend={handleSend}
          onUploadAttachment={handleUploadAttachment}
          onStop={handleStop}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onRateMessage={handleLike}
          onDislikeMessage={handleOpenDislikeModal}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onEditMessage={handleEditMessage}
          editingMessageIndexes={editingMessageIndexes}
          isAssistantTyping={isStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
          onSelectStarter={handleButtonSelect}
          streamErrorText={t(ChatI18nKeys.StreamError)}
          isReadOnly={isReadOnly}
          onDuplicateConversation={handleDuplicateConversation}
          duplicateError={duplicateError ?? undefined}
          isTranscriptionSupported={isTranscriptionSupported}
          onUploadAudio={handleUploadAudio}
          onTranscribeAudio={handleTranscribeAudio}
        />
      </div>

      {pendingDislikeMessageIndex != null && (
        <NegativeFeedbackModal
          onClose={handleDislikeModalClose}
          onSubmit={handleDislikeSubmit}
        />
      )}

      <DialConfirmationPopup
        open={pendingDeleteIndex != null}
        header={t(ChatI18nKeys.DeleteMessageTitle)}
        description={t(ChatI18nKeys.DeleteMessageDescription)}
        className="mobile:mx-4"
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDeleteIndex(null)}
      />

      <DialConfirmationPopup
        open={pendingStarterContext != null}
        header={t(ChatI18nKeys.StarterConfirmTitle)}
        description={
          pendingStarterContext?.starter['dial:widgetOptions']
            .confirmationMessage ?? ''
        }
        confirmLabel={t(ButtonsI18nKeys.Confirm)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        onConfirm={handleConfirmStarter}
        onClose={() => setPendingStarterContext(null)}
      />
    </>
  );
};
