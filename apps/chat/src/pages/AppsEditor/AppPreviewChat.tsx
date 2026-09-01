import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  attachmentsToDtos,
  findDeploymentByIdOrReference,
  getApiErrorDetails,
  getConversationPath,
  getQuickAppConversationStarters,
  getStarterPopulateText,
  useConversationHandlers,
  useConversationStream,
} from '@epam/ai-dial-chat-hooks';
import {
  MessageRating,
  generateUUID,
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
import { useGeneration } from '../../context/GenerationContext';
import { useNotification } from '../../context/NotificationContext';
import { useAudioTranscription } from '../../hooks/conversation/useAudioTranscription';
import {
  conversationsApi as configuredConversationsApi,
  filesApi as configuredFilesApi,
  rateApi as configuredRateApi,
} from '../../server-api/api-client';
import { CompletionMode } from '../../server-api/chat-stream.api';
import {
  createConversation as apiCreateConversation,
  deleteConversation as apiDeleteConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import { conversationStreamTransport } from '../../utils/conversation-stream-transport';
import { resolveCatalogIconUrl } from '../../utils/icon-path';

/*
 * Normalizes a deployment ID that may contain raw spaces (from app creation
 * responses that pre-date the encoding fix) to its percent-encoded form,
 * idempotently. Each path segment is decoded then re-encoded so that both
 * raw ("No Temp 3__1.0") and already-encoded ("No%20Temp%203__1.0") inputs
 * produce the same valid output.
 */
const normalizeDeploymentId = (id: string): string =>
  id
    .split('/')
    .map(segment => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');

interface Props {
  appId: string;
  appDisplayName?: string;
  appIconUrl?: string;
}

const AppPreviewChat: FC<Props> = ({ appId, appDisplayName, appIconUrl }) => {
  const { t } = useTranslation();
  const { showErrorNotification } = useNotification();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { items } = useDeployments();

  /*
   * `appId` is the application id (e.g. "applications/<bucket>/My App__1.0")
   * and matches `items[].id`. It is used as-is for UI (fixedModel, deployment
   * lookup, stream model id). When sent as `deploymentId` to
   * createConversation it must be normalized first — see normalizeDeploymentId
   * above — because older app creation responses returned raw spaces that the
   * backend validator now rejects.
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
      showErrorNotification({ title, message });
    },
    [showErrorNotification, t],
  );

  const { isAudioMessageSupported } = useAudioTranscription({
    selectedDeploymentId: appId,
  });

  const handleStopError = useCallback(() => {
    showErrorNotification({
      message: t(ChatI18nKeys.StreamError),
    });
  }, [showErrorNotification, t]);

  const { startGeneration, completeGeneration } = useGeneration();

  const { startStream, handleStop, isStreaming, canStopStreaming } =
    useConversationStream({
      conversationId: conversationId ?? undefined,
      state: { setConversation, conversationRef },
      transport: conversationStreamTransport,
      generation: { startGeneration, completeGeneration },
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
        normalizeDeploymentId(appId),
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
        generateUUID(),
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
          showErrorNotification({
            message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
            requestId: traceId,
          });
        }
      };

      void createFromStarter();
    },
    [handleCreateConversation, showErrorNotification, t],
  );

  /*
   * Deleting the last message in the conversation deletes the whole
   * conversation. There is no real route to navigate to in the preview —
   * this just resets local preview state.
   */
  const handleConversationDeleted = useCallback(() => {
    conversationRef.current = null;
    setConversation(null);
    setConversationId(null);
  }, []);

  const resolveModelId = useCallback(() => appId, [appId]);

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
    state: { setConversation, conversationRef },
    filesApi: configuredFilesApi,
    conversationsApi: configuredConversationsApi,
    rateApi: configuredRateApi,
    resolveModelId,
    onConversationDeleted: handleConversationDeleted,
    showNetworkError: handleNetworkUploadError,
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
