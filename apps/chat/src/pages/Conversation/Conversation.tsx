import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  getConversationPath,
  getFormSchemaToolSyncKey,
  getLastDeploymentId,
  getLatestToolConfiguration,
  isAwaitingGenerationResume,
  isConversationNotFoundError,
  shouldWatchForDisplayNameUpdate,
  useConversationHandlers,
  useConversationStream,
  useToolsMenu,
} from '@epam/ai-dial-chat-hooks';
import {
  generateUUID,
  MessageRating,
  MessageRole,
  type Conversation,
  type Message,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopup,
  ConfirmationPopupVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconTelescope } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router';
import ConversationView from '../../components/ConversationView/ConversationView';
import NegativeFeedbackModal from '../../components/ConversationView/Rate/NegativeFeedbackModal';
import ScheduledTaskConversationBanner from '../../components/ScheduledTaskConversationBanner/ScheduledTaskConversationBanner';
import { getConversationRoute } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationPanelI18nKeys,
  RateI18nKeys,
  ToolsI18nKeys,
} from '../../constants/translation-keys';
import { useActiveScheduledTask } from '../../context/ActiveScheduledTaskContext';
import { useUser } from '../../context/auth/UserContext';
import { useClientChannel } from '../../context/ClientChannelContext';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  ClientGenerationStatus,
  useGeneration,
} from '../../context/GenerationContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { useActiveConversationBridge } from '../../hooks/conversation/useActiveConversationBridge';
import { useAudioTranscription } from '../../hooks/conversation/useAudioTranscription';
import { useVisualizerMessageSendHandler } from '../../hooks/conversation/useVisualizerMessageSendHandler';
import { useDeploymentChangeEffect } from '../../hooks/useDeploymentChangeEffect';
import {
  conversationsApi as configuredConversationsApi,
  filesApi as configuredFilesApi,
  rateApi as configuredRateApi,
} from '../../server-api/api-client';
import { CompletionMode } from '../../server-api/chat-stream.api';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { ActiveScheduledTaskStatus } from '../../types/active-scheduled-task';
import { ROUTES } from '../../types/routes';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import {
  conversationStreamTransport,
  logConversationStreamError,
} from '../../utils/conversation-stream-transport';

interface Props {
  onDuplicateReadonly?: () => void;
}

export const ConversationPage: FC<Props> = ({ onDuplicateReadonly }) => {
  const { '*': conversationId } = useParams<{ '*': string }>();
  const { state, pathname, search } = useLocation();
  const prefetchedConversation =
    (state as { conversation?: Conversation } | null)?.conversation ?? null;
  const [conversation, setConversation] = useState<Conversation | null>(
    prefetchedConversation,
  );
  const [isFetching, setIsFetching] = useState(
    !prefetchedConversation && !!conversationId,
  );
  const conversationRef = useRef<Conversation | null>(null);
  const displayNameWatchCleanupRef = useRef<(() => void) | null>(null);
  const displayNameWatchKeyRef = useRef<string | null>(null);
  const notificationShownForRef = useRef<string | null>(null);
  const restoredToolConfigIdRef = useRef<string | null>(null);
  /* Key of the last assistant `form_schema` tool values applied to the toggles. */
  const appliedFormSchemaKeyRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    restoreSelectedItemId,
    selectedItemId: currentSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading: isDeploymentsLoading,
  } = useDeployments();
  const {
    toolsMenuItems,
    onToolToggle,
    toolConfigurationValue,
    restoreToolConfiguration,
  } = useToolsMenu({
    selectedItemId: currentSelectedItemId,
    selectedDeploymentConfiguration,
    toolIcon: (
      <IconTelescope
        size={DIAL_ICON_SIZE.SM}
        aria-hidden
        stroke={DIAL_KIT_ICON_STROKE}
      />
    ),
  });
  /*
   * `toolsMenuItems` is a new array on every render (the inline `toolIcon`
   * is part of its memo), so the ids are memoised by value instead.
   */
  const toolIdsSignature = JSON.stringify(toolsMenuItems.map(({ id }) => id));
  const toolIds = useMemo(
    (): string[] => JSON.parse(toolIdsSignature),
    [toolIdsSignature],
  );
  /* Read by `loadConversation` without making it depend on the tool list. */
  const toolIdsRef = useRef(toolIds);
  useEffect(() => {
    toolIdsRef.current = toolIds;
  }, [toolIds]);
  const {
    handleClose: handleCloseSourcesSidebar,
    setMessages,
    setConversationModelId,
  } = useSourcesSidebar();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { status: activeScheduledTaskStatus } = useActiveScheduledTask();
  const {
    conversations,
    duplicateConversation,
    updateConversationTitle,
    bumpConversationActivity,
    watchForDisplayNameUpdate,
    removeConversationFromList,
  } = useConversations();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const overlay = useOptionalOverlay();
  /*
   * One-shot text hand-off into the composer's textarea. The two writers differ
   * in kind, so they own separate channels: the overlay bridge's setInputContent
   * replaces the whole draft, while a picked prompt is inserted at the caret and
   * must leave the user's own writing alone ([#8754](https://github.com/epam/ai-dial-chat/issues/8754)).
   */
  const [pendingInputContent, setPendingInputContent] = useState({
    revision: 0,
    value: '',
  });
  const [pendingInputInsertion, setPendingInputInsertion] = useState({
    revision: 0,
    text: '',
  });
  const notifiedLoadedConversationIdRef = useRef<string | null>(null);

  const {
    isAudioMessageSupported,
    isVoiceRecordingSupported,
    handleTranscribeAudio,
  } = useAudioTranscription({
    selectedDeploymentId: currentSelectedItemId,
  });

  const { showSuccessNotification, showErrorNotification } = useNotification();

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      showErrorNotification({
        ...buildNetworkUploadErrorNotification(filenames, t),
      });
    },
    [showErrorNotification, t],
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
    // conversationRef is a stable ref — intentionally omitted from deps

    [conversationId],
  );

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
    setConversationModelId(
      conversation?.assistantModelId || conversation?.model.id,
    );
  }, [
    conversation?.messages,
    conversation?.assistantModelId,
    conversation?.model.id,
    setMessages,
    setConversationModelId,
  ]);

  /*
   * A DIAL app can switch a tool toggle per assistant message through its
   * `form_schema` (e.g. `deep_research` on while a run streams, off with the
   * final report). Each distinct value is applied once, so a toggle the user
   * flips afterwards survives re-renders until the app sends a new value.
   * Waits for the load-time restore of this id: until then `conversation`
   * may still hold the previous conversation's messages.
   */
  useEffect(() => {
    if (!conversationId || !conversation) return;
    if (restoredToolConfigIdRef.current !== conversationId) return;
    const sync = getFormSchemaToolSyncKey(
      conversationId,
      conversation.messages,
      toolIds,
    );
    if (!sync || sync.key === appliedFormSchemaKeyRef.current) return;
    appliedFormSchemaKeyRef.current = sync.key;
    restoreToolConfiguration(sync.values);
  }, [conversation, conversationId, restoreToolConfiguration, toolIds]);

  /*
   * Cleanup must run only on unmount. Both callbacks are stable, so keeping
   * `conversation?.messages` out of the deps stops the sources sidebar from
   * closing on every message mutation (stream chunk, the post-stream
   * conversation refetch, send, regenerate, edit, delete, status message).
   * Resets within `/conversations/*` are owned by
   * `useCloseSourcesSidebarOnSubjectChange` (mounted in the sources panel),
   * which closes the sidebar only when its subject changes — not on every
   * conversation-id change, so switching between runs of the same task keeps
   * it open ([#8840](https://github.com/epam/ai-dial-chat/issues/8840)).
   */
  useEffect(
    () => () => {
      handleCloseSourcesSidebar();
      setMessages([]);
      setConversationModelId(undefined);
    },
    [handleCloseSourcesSidebar, setMessages, setConversationModelId],
  );

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

  const { getGeneration, startGeneration, completeGeneration } =
    useGeneration();
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
  /*
   * Conversation paths whose auto-stream has already been kicked off. Guards
   * against React 18 StrictMode double-mounting (and any other re-run of
   * loadConversation) firing two concurrent generations, which the backend
   * rejects with 409 and surfaces as a spurious "Something went wrong" error.
   */
  const autoStartedPathsRef = useRef<Set<string>>(new Set());
  const handleStopError = useCallback(() => {
    showErrorNotification({
      message: t(ChatI18nKeys.StreamError),
    });
  }, [showErrorNotification, t]);

  const {
    startStream: startConversationStream,
    handleStop,
    resumeIfAwaitingGeneration,
    restoreBufferedGeneration,
    isStreaming,
    canStopStreaming,
    hasConversationReloadError,
    isReloadingConversation,
    retryConversationReload,
  } = useConversationStream({
    conversationId,
    state: { setConversation, conversationRef },
    transport: conversationStreamTransport,
    generation: { startGeneration, completeGeneration },
    channel,
    overlay,
    onStopError: handleStopError,
    generationConflictMessage: t(ChatI18nKeys.GenerationConflict),
    generationPersistenceErrorMessage: t(
      ChatI18nKeys.GenerationPersistenceError,
    ),
    onStreamError: logConversationStreamError,
    /* One commit per frame while a reply streams, not one per network read. */
    batchChunksPerFrame: true,
  });

  /*
   * Every generation this page can launch — send, regenerate, edit and the
   * auto-continue on load — funnels through startStream, so bumping the
   * sidebar entry here reorders the list by latest activity right away
   * instead of leaving it stale until the next full re-fetch.
   */
  const startStream = useCallback<typeof startConversationStream>(
    (streamedConversationId, ...rest) => {
      bumpConversationActivity(streamedConversationId);
      startConversationStream(streamedConversationId, ...rest);
    },
    [bumpConversationActivity, startConversationStream],
  );

  useEffect(() => {
    return () => {
      displayNameWatchCleanupRef.current?.();
    };
  }, []);

  const messageCount = conversation?.messages.length ?? 0;
  const conversationName = conversation?.name ?? '';

  useEffect(() => {
    if (
      !conversationId ||
      !conversation ||
      !shouldWatchForDisplayNameUpdate(conversation)
    ) {
      displayNameWatchKeyRef.current = null;
      displayNameWatchCleanupRef.current?.();
      displayNameWatchCleanupRef.current = null;
      return;
    }

    const watchKey = `${conversationId}:${messageCount}`;
    if (displayNameWatchKeyRef.current === watchKey) return;
    displayNameWatchKeyRef.current = watchKey;

    displayNameWatchCleanupRef.current?.();
    displayNameWatchCleanupRef.current = watchForDisplayNameUpdate(
      conversationId,
      conversationName,
      (title) => {
        setConversation((prev) =>
          prev
            ? ({ ...prev, name: title, llmNamingDone: true } as Conversation)
            : prev,
        );
        if (conversationRef.current) {
          conversationRef.current = {
            ...conversationRef.current,
            name: title,
            llmNamingDone: true,
          } as Conversation;
        }
        displayNameWatchCleanupRef.current = null;
      },
    );
  }, [
    conversation,
    conversationId,
    conversationName,
    messageCount,
    watchForDisplayNameUpdate,
  ]);

  const loadConversation = useCallback(
    async (id: string, initialData?: Conversation | null) => {
      if (!initialData) {
        setIsFetching(true);
      }
      try {
        const loadedConversation: Conversation =
          initialData ?? ((await apiGetConversation(id)) as Conversation);
        const result = restoreBufferedGeneration(id, loadedConversation);
        if (result.name) {
          updateConversationTitle(id, result.name);
        }

        /*
         * Restore the last selected agent from the conversation's change history
         * so the deployment selector reflects what was active, not the default.
         */
        const lastDeploymentId = getLastDeploymentId(result.messages);
        const modelToSelect =
          lastDeploymentId ?? (result.assistantModelId || result.model.id);
        if (modelToSelect) {
          restoreSelectedItemId(modelToSelect);
        }
        if (restoredToolConfigIdRef.current !== id) {
          restoredToolConfigIdRef.current = id;
          restoreToolConfiguration(getLatestToolConfiguration(result.messages));
          appliedFormSchemaKeyRef.current =
            getFormSchemaToolSyncKey(id, result.messages, toolIdsRef.current)
              ?.key ?? null;
        }

        const lastMsg = result.messages[result.messages.length - 1];

        if (lastMsg?.role === MessageRole.User) {
          /*
           * The conversation still awaits an assistant reply: show the typing
           * placeholder so streamed chunks have a slot to land in.
           */
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

          /*
           * Start the generation only once per conversation. Guards against
           * React StrictMode double-mounting (and any re-run of loadConversation)
           * launching a second stream — which the backend rejects with 409.
           */
          const conversationPath = getConversationPath(id);
          const alreadyStarted =
            autoStartedPathsRef.current.has(conversationPath) ||
            getGeneration(conversationPath)?.status ===
              ClientGenerationStatus.Active;
          if (!alreadyStarted) {
            autoStartedPathsRef.current.add(conversationPath);
            startStream(
              id,
              lastMsg.content,
              withPlaceholder.messages.length - 1,
              lastDeploymentId ?? result.model.id,
              lastMsg.custom_content,
              generateUUID(),
              CompletionMode.ContinueLastUser,
              /*
               * A reload can land here before the backend saved this turn's
               * start state while it still generates it; its 409 then means
               * "join that generation", not "conflict".
               */
              { resumeOnConflict: true },
            );
          }
        } else {
          setConversation(result);
          conversationRef.current = result;

          /*
           * A hard refresh mid-generation loads the backend's empty
           * start-state placeholder (no incremental save exists to show
           * partial content). Watch for its resolution instead of leaving a
           * static empty bubble — see resumeIfAwaitingGeneration.
           */
          if (isAwaitingGenerationResume(result)) {
            resumeIfAwaitingGeneration(id, result);
          }
        }
      } catch (error) {
        if (notificationShownForRef.current !== id) {
          notificationShownForRef.current = id;
          const { traceId } = await getApiErrorDetails(error);
          showErrorNotification({
            message: t(ChatI18nKeys.ConversationNotFound),
            requestId: traceId,
          });
        }
        /* Self-heal the panel: a conversation the backend no longer has (deleted
         * here, in another tab, or by emptying its messages) must not stay in the
         * list, where every later open or delete would fail the same way. */
        if (isConversationNotFoundError(error)) {
          removeConversationFromList(id);
        }
        navigate(ROUTES.Root);
      } finally {
        setIsFetching(false);
      }
    },
    [
      navigate,
      restoreSelectedItemId,
      restoreToolConfiguration,
      startStream,
      resumeIfAwaitingGeneration,
      restoreBufferedGeneration,
      updateConversationTitle,
      getGeneration,
      removeConversationFromList,
      showErrorNotification,
      t,
    ],
  );

  /*
   * `loadConversation` is recreated whenever `startStream` is (which itself
   * changes identity on every client-channel connect/idle-disconnect cycle —
   * see client-channel-idle-disconnect) — read the latest version through a
   * ref so the mount-load effect below only re-runs for a real `conversationId`
   * change, not for unrelated churn in one of loadConversation's many deps.
   */
  const loadConversationRef = useRef(loadConversation);
  useEffect(() => {
    loadConversationRef.current = loadConversation;
  });

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }
    void loadConversationRef.current(conversationId, prefetchedConversation);
    /*
     * prefetchedConversation intentionally omitted: it is router state captured at mount,
     * re-running when it changes would re-initialize an already-loaded conversation.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const clearedPrefetchIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId || !prefetchedConversation) return;
    if (clearedPrefetchIdRef.current === conversationId) return;
    clearedPrefetchIdRef.current = conversationId;
    /*
     * history.state survives a hard refresh, so leaving the just-created
     * user-only snapshot in it would make every reload re-run the auto-start
     * stream instead of fetching the up-to-date conversation from the server.
     */
    navigate(`${pathname}${search}`, { replace: true, state: null });
  }, [conversationId, prefetchedConversation, navigate, pathname, search]);

  const resolveModelId = useCallback(
    () => currentSelectedItemId ?? conversation?.model.id ?? '',
    [currentSelectedItemId, conversation?.model.id],
  );

  const handleConversationDeleted = useCallback(() => {
    if (conversationId) removeConversationFromList(conversationId);
    navigate(ROUTES.Root);
  }, [conversationId, navigate, removeConversationFromList]);

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
    state: { setConversation, conversationRef },
    filesApi: configuredFilesApi,
    conversationsApi: configuredConversationsApi,
    rateApi: configuredRateApi,
    resolveModelId,
    onConversationDeleted: handleConversationDeleted,
    showNetworkError: handleNetworkUploadError,
    toolConfigurationValue,
  });

  useEffect(() => {
    if (!overlay || isFetching || !conversation || !conversationId) return;
    if (notifiedLoadedConversationIdRef.current === conversationId) return;
    notifiedLoadedConversationIdRef.current = conversationId;
    overlay.notifyConversationLoaded();
  }, [overlay, isFetching, conversation, conversationId]);

  const handleSetPendingInputContent = useCallback((content: string) => {
    setPendingInputContent((prev) => ({
      revision: prev.revision + 1,
      value: content,
    }));
  }, []);

  const handleInsertText = useCallback((text: string) => {
    setPendingInputInsertion((prev) => ({
      revision: prev.revision + 1,
      text,
    }));
  }, []);

  const handleVisualizerSendMessage = useVisualizerMessageSendHandler({
    conversationId,
    isStreaming,
    isReadOnly,
    handleSend,
  });

  useActiveConversationBridge({
    conversation,
    conversationId,
    conversationRef,
    setConversation,
    handleSend,
    setOverlayInputContent: handleSetPendingInputContent,
  });

  const handleLike = useCallback(
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
        showSuccessNotification({
          title: t(RateI18nKeys.DislikeToastTitle),
          message: t(RateI18nKeys.LikeToastDescription),
        });
      }
    },
    [pendingDislikeMessageIndex, handleRateMessage, showSuccessNotification, t],
  );

  const handleDislikeModalClose = useCallback(() => {
    setPendingDislikeMessageIndex(null);
  }, []);

  /* Stable props so memo(ConversationView) skips re-rendering long message lists. */
  const toolsChipLabels = useMemo(
    () => ({
      removeLabel: (label: string) => t(ToolsI18nKeys.RemoveTool, { label }),
      stateOnLabel: t(ToolsI18nKeys.StateOn),
      stateOffLabel: t(ToolsI18nKeys.StateOff),
    }),
    [t],
  );

  const topContent = useMemo(
    () =>
      activeScheduledTaskStatus ===
      ActiveScheduledTaskStatus.TaskConversation ? (
        <ScheduledTaskConversationBanner />
      ) : undefined,
    [activeScheduledTaskStatus],
  );

  if (isFetching)
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner />
      </div>
    );

  if (!conversation) {
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
          hasConversationReloadError={hasConversationReloadError}
          isReloadingConversation={isReloadingConversation}
          onRetryConversationReload={retryConversationReload}
          canStopAssistant={canStopStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
          onSelectStarter={handleButtonSelect}
          onVisualizerSendMessage={handleVisualizerSendMessage}
          stoppedGeneratingText={t(ChatI18nKeys.StoppedGenerating)}
          isReadOnly={isReadOnly}
          onDuplicateConversation={handleDuplicateConversation}
          duplicateError={duplicateError ?? undefined}
          isAudioMessageSupported={isAudioMessageSupported}
          isVoiceRecordingSupported={isVoiceRecordingSupported}
          onTranscribeAudio={handleTranscribeAudio}
          conversation={conversation}
          onConversationChange={handleConversationChange}
          inputContent={pendingInputContent.value}
          inputContentRevision={pendingInputContent.revision}
          inputInsertion={pendingInputInsertion}
          onInsertText={handleInsertText}
          toolsMenuItems={toolsMenuItems}
          onToolToggle={onToolToggle}
          toolsMenuTitle={t(ToolsI18nKeys.MenuTitle)}
          toolsChipLabels={toolsChipLabels}
          topContent={topContent}
        />
      </div>

      {pendingDislikeMessageIndex != null && (
        <NegativeFeedbackModal
          onClose={handleDislikeModalClose}
          onSubmit={handleDislikeSubmit}
        />
      )}

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

      <ConfirmationPopup
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
