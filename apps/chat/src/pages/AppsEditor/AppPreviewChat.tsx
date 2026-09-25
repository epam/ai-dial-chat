import type {
  ConversationResponseDto,
  DeploymentDetailsDto,
} from '@epam/ai-dial-chat-api-client';
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
  useComposerSeed,
  useComposerSeedSource,
} from '@epam/ai-dial-conversation-input';
import {
  generateUUID,
  MessageRating,
  MessageRole,
  ResponseFormat,
  type Attachment,
  type Conversation,
  type Message,
  type RequestSkill,
  type StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  Spinner,
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
import NegativeFeedbackModal from '../../components/ConversationView/Rate/NegativeFeedbackModal';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import { useSkillSelectorOverlay } from '../../components/SkillSelector/useSkillSelectorOverlay';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  RateI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useClientChannel } from '../../context/ClientChannelContext';
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
import { getDeploymentDetails } from '../../server-api/deployments';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import {
  conversationStreamTransport,
  logConversationStreamError,
} from '../../utils/conversation-stream-transport';
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
    .map((segment) => {
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
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { items, isLoading: isDeploymentsLoading } = useDeployments();

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

  /*
   * The preview's fixed agent never goes through DeploymentsContext's own
   * selection (it isn't the globally selected deployment), so nothing there
   * fetches its details. Fetched here directly, in parallel with the full
   * deployments list (`items` above), so skills-support gating below doesn't
   * have to wait for that list to resolve `appId`.
   */
  const [appDeploymentDetails, setAppDeploymentDetails] =
    useState<DeploymentDetailsDto | null>(null);
  const [isAppDetailsLoading, setIsAppDetailsLoading] = useState(true);
  useEffect(() => {
    let isCancelled = false;
    setAppDeploymentDetails(null);
    setIsAppDetailsLoading(true);
    getDeploymentDetails(appId)
      .then((details) => {
        if (!isCancelled) setAppDeploymentDetails(details);
      })
      .catch(() => {
        // Best-effort early fallback — appDeployment (from the full list) still resolves normally.
      })
      .finally(() => {
        if (!isCancelled) setIsAppDetailsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [appId]);
  const appDeploymentDetailsEntity =
    appDeploymentDetails?.modelDetails ??
    appDeploymentDetails?.applicationDetails;
  const isAppSkillsSupported =
    appDeployment?.features?.skillsSupported === true ||
    (!appDeployment &&
      appDeploymentDetailsEntity?.features?.skillsSupported === true);
  /*
   * Neither source has resolved this app yet: showing the composer now would
   * flash starters/skill-support in as soon as whichever request lands, so a
   * spinner covers the gap instead. Whichever of the list or the direct
   * details fetch resolves first clears it — the other one filling in later
   * only refines features/starters behind the scenes.
   */
  const isAppInfoLoading =
    !appDeployment &&
    !appDeploymentDetails &&
    (isDeploymentsLoading || isAppDetailsLoading);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
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

  const {
    isAudioMessageSupported,
    isVoiceRecordingSupported,
    handleTranscribeAudio,
  } = useAudioTranscription({
    selectedDeploymentId: appId,
  });

  const handleStopError = useCallback(() => {
    showErrorNotification({
      message: t(ChatI18nKeys.StreamError),
    });
  }, [showErrorNotification, t]);

  const { startGeneration, completeGeneration } = useGeneration();
  const {
    channelId,
    ensureConnected,
    waitForChannel,
    notifyGenerationSettled,
  } = useClientChannel();
  const channel = useMemo(
    () => ({
      channelId,
      ensureConnected,
      waitForChannel,
      notifyGenerationSettled,
    }),
    [channelId, ensureConnected, waitForChannel, notifyGenerationSettled],
  );

  const { startStream, handleStop, isStreaming, canStopStreaming } =
    useConversationStream({
      conversationId: conversationId ?? undefined,
      state: { setConversation, conversationRef },
      transport: conversationStreamTransport,
      generation: { startGeneration, completeGeneration },
      channel,
      onStopError: handleStopError,
      generationConflictMessage: t(ChatI18nKeys.GenerationConflict),
      generationPersistenceErrorMessage: t(
        ChatI18nKeys.GenerationPersistenceError,
      ),
      onStreamError: logConversationStreamError,
    });

  /*
   * Skills in the preview's pre-conversation composer: the same host wiring
   * the main chat uses (flag, the app deployment's skills support, listing
   * and favorites contexts, catalog picker, details panel). Once the
   * conversation exists, the shared ConversationView below wires its own
   * instance for the ongoing input and history display — this one serves
   * only the composer phase.
   */
  const {
    skillMenuOverlay,
    commandMenu,
    skillCatalogModal,
    skillDetailsPanel,
    message: skillMessage,
    messageRevision: skillMessageRevision,
    activeMentions,
    onDraftChange,
    onBackspaceAtCaret,
    caretPositionOverride,
    selectedSkills,
    isSkillUnsupported,
    resetSkillMentions,
    seedSkillMentions,
  } = useSkillSelectorOverlay({
    isSkillsSupported: isAppSkillsSupported,
  });

  /*
   * Merges the starter-selection seed (`seedComposerText`) with the skill
   * hook's own message/messageRevision push (a mention insertion) into the
   * one message/messageRevision pair `NewConversationComposer` accepts.
   */
  const {
    message: composerSeedText,
    messageRevision: composerSeedRevision,
    seedMessage: seedComposerText,
  } = useComposerSeed();
  useComposerSeedSource(skillMessageRevision, () =>
    seedComposerText(skillMessage),
  );

  const handleCreateConversation = useCallback(
    async (
      message: string,
      attachments: Attachment[],
      chatSettingsValues: NewConversationChatSettings,
      skills?: RequestSkill[],
    ) => {
      const attachmentDtos = attachmentsToDtos(attachments || []);
      /*
       * The textarea itself clears the instant `onSend` fires (`Input.tsx`'s
       * own `handleSend`), but the composer only unmounts once
       * `setConversationId` below flips this preview to the `ConversationView`
       * branch — after two awaited API calls. Without resetting here first,
       * the mention chip stays tracked (and visibly rendered over the
       * now-empty, placeholder-showing input) for that entire gap. Restored
       * on failure below so a retry still has its skill mention.
       */
      resetSkillMentions();
      try {
        const created = await apiCreateConversation(
          message,
          normalizeDeploymentId(appId),
          attachmentDtos,
          undefined,
          undefined,
          skills,
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
          attachmentDtos?.length || skills?.length
            ? {
                ...(attachmentDtos?.length
                  ? { attachments: attachmentDtos }
                  : {}),
                ...(skills?.length ? { skills } : {}),
              }
            : undefined,
          generateUUID(),
          CompletionMode.ContinueLastUser,
        );
      } catch (err) {
        seedSkillMentions(message, skills);
        throw err;
      }
    },
    [appId, startStream, resetSkillMentions, seedSkillMentions],
  );

  /*
   * The composer's send carries the selected skill; the starter path below
   * creates without one, mirroring the main chat's starter flow.
   */
  const handleCreateFromComposer = useCallback(
    (
      message: string,
      attachments: Attachment[],
      chatSettingsValues: NewConversationChatSettings,
    ) =>
      handleCreateConversation(
        message,
        attachments,
        chatSettingsValues,
        selectedSkills,
      ),
    [handleCreateConversation, selectedSkills],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      const text = getStarterPopulateText(starter);
      if (!starter['dial:widgetOptions'].submit) {
        seedComposerText(text);
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
    [handleCreateConversation, showErrorNotification, t, seedComposerText],
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
    async (messageIndex: number, rating: MessageRating | null) => {
      const success = await handleRateMessage(messageIndex, rating);
      if (success && rating === MessageRating.Like) {
        showSuccessNotification({
          title: t(RateI18nKeys.LikeToastTitle),
          message: t(RateI18nKeys.LikeToastDescription),
        });
      }
    },
    [handleRateMessage, showSuccessNotification, t],
  );

  const [pendingDislikeMessageIndex, setPendingDislikeMessageIndex] = useState<
    number | null
  >(null);

  const handleOpenDislikeModal = useCallback((messageIndex: number) => {
    setPendingDislikeMessageIndex(messageIndex);
  }, []);

  const handleDislikeModalClose = useCallback(() => {
    setPendingDislikeMessageIndex(null);
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
        showSuccessNotification({
          title: t(RateI18nKeys.DislikeToastTitle),
          message: t(RateI18nKeys.LikeToastDescription),
        });
      }
    },
    [pendingDislikeMessageIndex, handleRateMessage, showSuccessNotification, t],
  );

  if (isAppInfoLoading) {
    return (
      <div
        role="region"
        aria-label={t(AppsEditorI18nKeys.PreviewChatAriaLabel)}
        className="flex size-full items-center justify-center"
      >
        <Spinner />
      </div>
    );
  }

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
            message={composerSeedText}
            messageRevision={composerSeedRevision}
            onChange={onDraftChange}
            onCreateConversation={handleCreateFromComposer}
            menuOverlays={skillMenuOverlay ? [skillMenuOverlay] : undefined}
            activeMentions={activeMentions}
            onBackspaceAtCaret={onBackspaceAtCaret}
            caretPositionOverride={caretPositionOverride}
            isSkillUnsupported={isSkillUnsupported}
            commandMenu={commandMenu}
          >
            <StarterButtons
              starters={quickAppStarters.starters}
              onSelect={handleStarterSelect}
            />
          </NewConversationComposer>
        </Suspense>
        {skillCatalogModal}
        {skillDetailsPanel}
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
        onDislikeMessage={handleOpenDislikeModal}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onEditMessage={handleEditMessage}
        editingMessageIndexes={editingMessageIndexes}
        isAssistantTyping={isStreaming}
        canStopAssistant={canStopStreaming}
        placeholder={t(AppsEditorI18nKeys.PreviewChatPlaceholder)}
        stoppedGeneratingText={t(ChatI18nKeys.StoppedGenerating)}
        isAudioMessageSupported={isAudioMessageSupported}
        isVoiceRecordingSupported={isVoiceRecordingSupported}
        onTranscribeAudio={handleTranscribeAudio}
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

      {pendingDislikeMessageIndex != null && (
        <NegativeFeedbackModal
          onClose={handleDislikeModalClose}
          onSubmit={handleDislikeSubmit}
        />
      )}
    </div>
  );
};

export default memo(AppPreviewChat);
