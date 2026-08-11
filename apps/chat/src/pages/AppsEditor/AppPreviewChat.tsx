import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  MessageRating,
  MessageRole,
  ResponseFormat,
  type Attachment,
  type Conversation,
  type Message,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  ConfirmationPopup,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router';
import ConversationView from '../../components/ConversationView/ConversationView';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useAudioTranscription } from '../../hooks/conversation/useAudioTranscription';
import { useConversationHandlers } from '../../hooks/conversation/useConversationHandlers';
import { useConversationStream } from '../../hooks/conversation/useConversationStream';
import { getApiErrorDetails } from '../../server-api/api-error';
import { CompletionMode } from '../../server-api/chat-stream.api';
import {
  createConversation as apiCreateConversation,
  deleteConversation as apiDeleteConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { ROUTES } from '../../types/routes';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { getQuickAppConversationStarters } from '../../utils/quick-app-conversation-starters';
import { getStarterPopulateText } from '../../utils/starter-option';

interface Props {
  appId: string;
  appDisplayName?: string;
  appIconUrl?: string;
}

const AppPreviewChat: FC<Props> = ({ appId, appDisplayName, appIconUrl }) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { items } = useDeployments();

  /*
   * `appId` is the raw, human-readable application id (e.g.
   * "applications/<bucket>/My App__1.0") and matches `items[].id`. It is used
   * as-is everywhere here — deploymentId/model/deployment are always sent as
   * JSON body fields (createConversation, streamCompletion, transcribeAudio),
   * never a raw URL path segment, so percent-encoding it would only embed
   * literal `%` characters that get double-encoded once the conversation's
   * stored path is built from it.
   */
  const fixedModel = useMemo(
    () => ({
      id: appId,
      displayName: appDisplayName,
      iconUrl: resolveCatalogIconUrl(appIconUrl),
    }),
    [appId, appDisplayName, appIconUrl],
  );

  const appDeployment = useMemo(
    () => findDeploymentByIdOrReference(items, appId),
    [items, appId],
  );
  const quickAppStarters = useMemo(
    () => getQuickAppConversationStarters(appDeployment?.conversationStarters),
    [appDeployment?.conversationStarters],
  );

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const conversationRef = useRef<Conversation | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(
    () => () => {
      const idToDelete = conversationIdRef.current;
      if (idToDelete) {
        apiDeleteConversation(getConversationPath(idToDelete)).catch(() => {
          // Best-effort cleanup on exit — failures must not block navigation.
        });
      }
    },
    [],
  );

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      const { title, message } = buildNetworkUploadErrorNotification(
        filenames,
        t,
      );
      showNotification({ variant: NotificationVariant.Error, title, message });
    },
    [showNotification, t],
  );

  const { isAudioMessageSupported } = useAudioTranscription({
    selectedDeploymentId: appId,
  });

  const handleStopError = useCallback(() => {
    showNotification({
      variant: NotificationVariant.Error,
      message: t(ChatI18nKeys.StreamError),
    });
  }, [showNotification, t]);

  const { startStream, handleStop, isStreaming, canStopStreaming } =
    useConversationStream({
      conversationId: conversationId ?? undefined,
      setConversation,
      conversationRef,
      onStopError: handleStopError,
    });

  const handleCreateConversation = useCallback(
    async (
      message: string,
      attachments: Attachment[],
      chatSettingsValues: NewConversationChatSettings,
    ) => {
      const attachmentDtos = attachmentsToDtos(attachments || []);
      const created = await apiCreateConversation(
        message,
        appId,
        attachmentDtos,
      );
      const savedConversation = {
        ...created,
        prompt: chatSettingsValues.systemPrompt,
        temperature: chatSettingsValues.temperature,
        responseFormat: chatSettingsValues.responseFormat,
      } as ConversationResponseDto;
      await saveConversation(
        getConversationPath(created.id),
        savedConversation,
      );

      const assistantPlaceholder: Message = {
        role: MessageRole.Assistant,
        content: '',
        timestamp: new Date().toISOString(),
      };
      const createdConversation = savedConversation as Conversation;
      const withPlaceholder = {
        ...createdConversation,
        messages: [...createdConversation.messages, assistantPlaceholder],
      };
      conversationRef.current = withPlaceholder;
      setConversation(withPlaceholder);
      setConversationId(created.id);

      startStream(
        created.id,
        message,
        withPlaceholder.messages.length - 1,
        appId,
        attachmentDtos?.length ? { attachments: attachmentDtos } : undefined,
        crypto.randomUUID(),
        CompletionMode.ContinueLastUser,
      );
    },
    [appId, startStream],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      const text = getStarterPopulateText(starter);
      if (!starter['dial:widgetOptions'].submit) {
        setInputMessage(text);
        return;
      }

      const createFromStarter = async () => {
        try {
          await handleCreateConversation(text, [], {
            responseFormat: ResponseFormat.Markdown,
            systemPrompt: '',
            temperature: 0.5,
          });
        } catch (err) {
          const { message: errorMessage, traceId } =
            await getApiErrorDetails(err);
          showNotification({
            variant: NotificationVariant.Error,
            message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
            requestId: traceId,
          });
        }
      };

      void createFromStarter();
    },
    [handleCreateConversation, showNotification, t],
  );

  /*
   * useConversationHandlers only ever calls `navigate(ROUTES.Root)`, triggered by
   * deleting the last message in the conversation. This stub handles only that
   * case and resets local preview state instead of performing a real route
   * navigation. The cast to NavigateFunction below is intentional: it satisfies
   * useConversationHandlers's prop type without implementing the full
   * NavigateFunction contract, since no other call shape is used here.
   */
  const handlePreviewNavigate = useCallback((to: unknown) => {
    if (to === ROUTES.Root) {
      conversationRef.current = null;
      setConversation(null);
      setConversationId(null);
    }
  }, []);

  const {
    handleSend,
    handleUploadAttachment: handlePostCreateUploadAttachment,
    handleRegenerateMessage,
    handleDeleteMessage,
    handleConfirmDelete,
    handleRateMessage,
    handleStartEdit,
    handleCancelEdit,
    handleEditMessage,
    editingMessageIndexes,
    pendingDeleteIndex,
    setPendingDeleteIndex,
  } = useConversationHandlers({
    conversation,
    conversationId: conversationId ?? undefined,
    bucket,
    isStreaming,
    startStream,
    conversationRef,
    setConversation,
    navigate: handlePreviewNavigate as NavigateFunction,
    showNetworkError: handleNetworkUploadError,
    fixedModelId: appId,
  });

  const handleConversationChange = useCallback(
    (updated: Conversation) => {
      setConversation(updated);
      conversationRef.current = updated;
      if (conversationId) {
        void saveConversation(
          getConversationPath(conversationId),
          updated as ConversationResponseDto,
        );
      }
    },
    [conversationId],
  );

  const handleRate = useCallback(
    (messageIndex: number, rating: MessageRating | null) => {
      void handleRateMessage(messageIndex, rating);
    },
    [handleRateMessage],
  );

  const handleDislike = useCallback(
    (messageIndex: number) => {
      void handleRateMessage(messageIndex, MessageRating.Dislike);
    },
    [handleRateMessage],
  );

  if (!conversationId || !conversation) {
    return (
      <div
        role="region"
        aria-label={t(AppsEditorI18nKeys.PreviewChatAriaLabel)}
        className="relative flex size-full flex-col overflow-y-auto"
      >
        <Suspense fallback={null}>
          <NewConversationComposer
            deployments={[fixedModel]}
            selectedDeploymentId={appId}
            isModelSelectorDisabled
            selectedDeployment={appDeployment}
            isInputDisabled={quickAppStarters.isChatMessageInputDisabled}
            placeholder={t(AppsEditorI18nKeys.PreviewChatPlaceholder)}
            introText={quickAppStarters.introText}
            message={inputMessage}
            onCreateConversation={handleCreateConversation}
          >
            <StarterButtons
              starters={quickAppStarters.starters}
              onSelect={handleStarterSelect}
            />
          </NewConversationComposer>
        </Suspense>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={t(AppsEditorI18nKeys.PreviewChatAriaLabel)}
      className="flex size-full flex-col"
    >
      <ConversationView
        messages={conversation.messages}
        initialModelId={appId}
        fixedModel={fixedModel}
        onSend={handleSend}
        onUploadAttachment={handlePostCreateUploadAttachment}
        onStop={handleStop}
        onDeleteMessage={handleDeleteMessage}
        onRegenerateMessage={handleRegenerateMessage}
        onRateMessage={handleRate}
        onDislikeMessage={handleDislike}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onEditMessage={handleEditMessage}
        editingMessageIndexes={editingMessageIndexes}
        isAssistantTyping={isStreaming}
        canStopAssistant={canStopStreaming}
        placeholder={t(AppsEditorI18nKeys.PreviewChatPlaceholder)}
        stoppedGeneratingText={t(ChatI18nKeys.StoppedGenerating)}
        isAudioMessageSupported={isAudioMessageSupported}
        conversation={conversation}
        onConversationChange={handleConversationChange}
      />

      <ConfirmationPopup
        open={pendingDeleteIndex != null}
        header={t(ChatI18nKeys.DeleteMessageTitle)}
        description={t(ChatI18nKeys.DeleteMessageDescription)}
        confirmLabel={t(ButtonsI18nKeys.Delete)}
        cancelLabel={t(ButtonsI18nKeys.Cancel)}
        variant={ConfirmationPopupVariant.Danger}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDeleteIndex(null)}
      />
    </div>
  );
};

export default memo(AppPreviewChat);
