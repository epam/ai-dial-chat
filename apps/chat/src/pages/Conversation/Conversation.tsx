import {
  Attachment,
  isAudioTranscriptionSupported,
  Conversation,
  Message,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DialConfirmationPopup,
} from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationView from '../../components/ConversationView/ConversationView';
import { ROUTES } from '../../constants/routes';
import {
  ActionsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
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
import { buildUploadPath } from '../../utils/build-upload-path';
import { decodeConversationId } from '../../utils/conversation-path';
import { getLastDeploymentId } from '../../utils/message-utils';

export const ConversationPage: FC = () => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isFetching, setIsFetching] = useState(!!conversationId);
  const conversationRef = useRef<Conversation | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { asrModelId, transcribeSizeLimitBytes } = useAppConfig();
  const {
    items: deploymentItems,
    setSelectedItemId,
    selectedItemId: currentSelectedItemId,
    isLoading: isDeploymentsLoading,
  } = useDeployments();
  const { handleClose: handleCloseSourcesSidebar, setMessages } =
    useSourcesSidebar();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';

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

  const isReadOnly = useMemo(() => {
    if (!conversationId || !bucket) return false;
    const decoded = decodeConversationId(conversationId);
    const slashIndex = decoded.indexOf('/');
    return slashIndex !== -1 && decoded.slice(0, slashIndex) !== bucket;
  }, [conversationId, bucket]);

  useEffect(() => {
    setMessages(conversation?.messages ?? []);
    return () => handleCloseSourcesSidebar();
  }, [handleCloseSourcesSidebar, conversation?.messages, setMessages]);

  const addStatusMessage = useCallback(
    (msg: Message) => {
      if (!conversationId) return;
      const decoded = decodeConversationId(conversationId);
      const conversationPath = decoded.substring(decoded.indexOf('/') + 1);
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

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }

    const decodedConversationId = decodeConversationId(conversationId);
    const conversationPath = decodedConversationId.substring(
      decodedConversationId.indexOf('/') + 1,
    );

    setIsFetching(true);
    apiGetConversation(decodedConversationId)
      .then((dto) => {
        const result = dto as unknown as Conversation;

        // Restore the last selected agent from the conversation's change history
        // so the deployment selector reflects what was active, not the default.
        const lastDeploymentId = getLastDeploymentId(result.messages);
        if (lastDeploymentId) {
          setSelectedItemId(lastDeploymentId);
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
            conversationPath,
            lastMsg.content,
            withPlaceholder.messages.length - 1,
            lastDeploymentId ?? result.model.id,
            lastMsg.custom_content,
          );
        } else {
          setConversation(result);
        }
      })
      .catch(() => navigate(ROUTES.ROOT))
      .finally(() => setIsFetching(false));
  }, [conversationId, navigate, setSelectedItemId, startStream]);

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
  });

  if (isFetching) return null;

  if (!conversation) {
    navigate(ROUTES.ROOT);
    return null;
  }

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center overflow-hidden">
        <ConversationView
          messages={conversation.messages}
          initialModelId={conversation.assistantModelId}
          onSend={handleSend}
          onUploadAttachment={handleUploadAttachment}
          onStop={handleStop}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onRateMessage={handleRateMessage}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onEditMessage={handleEditMessage}
          editingMessageIndexes={editingMessageIndexes}
          isAssistantTyping={isStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
          onSelectStarter={handleButtonSelect}
          streamErrorText={t(ChatI18nKeys.StreamError)}
          isReadOnly={isReadOnly}
          readOnlyNotice={t(ChatI18nKeys.ReadOnlyNotice)}
          isTranscriptionSupported={isTranscriptionSupported}
          onUploadAudio={handleUploadAudio}
          onTranscribeAudio={handleTranscribeAudio}
        />
      </div>

      <DialConfirmationPopup
        open={pendingDeleteIndex != null}
        header={t(ChatI18nKeys.DeleteMessageTitle)}
        description={t(ChatI18nKeys.DeleteMessageDescription)}
        confirmLabel={t(ActionsI18nKeys.Delete)}
        cancelLabel={t(ActionsI18nKeys.Cancel)}
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
        confirmLabel={t(ActionsI18nKeys.Confirm)}
        cancelLabel={t(ActionsI18nKeys.Cancel)}
        onConfirm={handleConfirmStarter}
        onClose={() => setPendingStarterContext(null)}
      />
    </>
  );
};
