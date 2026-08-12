import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  MessageRating,
  MessageRole,
  type Conversation,
  type Message,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  ConfirmationPopup,
  Spinner,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
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
import { useConversationHandlers } from '../../hooks/conversation/useConversationHandlers';
import { useConversationStream } from '../../hooks/conversation/useConversationStream';
import { useToolsMenu } from '../../hooks/conversation/useToolsMenu';
import { useDeploymentChangeEffect } from '../../hooks/useDeploymentChangeEffect';
import { getApiErrorDetails } from '../../server-api/api-error';
import { CompletionMode } from '../../server-api/chat-stream.api';
import {
  getConversation as apiGetConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { ActiveScheduledTaskStatus } from '../../types/active-scheduled-task';
import { ROUTES } from '../../types/routes';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import { getConversationPath } from '../../utils/conversation-path';
import { shouldWatchForDisplayNameUpdate } from '../../utils/display-name-watch';
import { isAwaitingGenerationResume } from '../../utils/generation-resume';
import { getLastDeploymentId } from '../../utils/message-utils';

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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    restoreSelectedItemId,
    selectedItemId: currentSelectedItemId,
    isLoading: isDeploymentsLoading,
  } = useDeployments();
  const { handleClose: handleCloseSourcesSidebar, setMessages } =
    useSourcesSidebar();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const { status: activeScheduledTaskStatus } = useActiveScheduledTask();
  const {
    conversations,
    duplicateConversation,
    updateConversationTitle,
    watchForDisplayNameUpdate,
  } = useConversations();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const overlay = useOptionalOverlay();
  /*
   * One-shot text hand-off into the composer's textarea: the overlay bridge
   * and prompt insertion both write here rather than each owning a separate
   * revision-token channel.
   */
  const [pendingInputContent, setPendingInputContent] = useState({
    revision: 0,
    value: '',
  });
  const notifiedLoadedConversationIdRef = useRef<string | null>(null);

  const { isAudioMessageSupported } = useAudioTranscription({
    selectedDeploymentId: currentSelectedItemId,
  });

  const { showNotification } = useNotification();

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      showNotification({
        variant: NotificationVariant.Error,
        ...buildNetworkUploadErrorNotification(filenames, t),
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

  const { getGeneration } = useGeneration();
  /*
   * Conversation paths whose auto-stream has already been kicked off. Guards
   * against React 18 StrictMode double-mounting (and any other re-run of
   * loadConversation) firing two concurrent generations, which the backend
   * rejects with 409 and surfaces as a spurious "Something went wrong" error.
   */
  const autoStartedPathsRef = useRef<Set<string>>(new Set());
  const handleStopError = useCallback(() => {
    showNotification({
      variant: NotificationVariant.Error,
      message: t(ChatI18nKeys.StreamError),
    });
  }, [showNotification, t]);

  const {
    startStream,
    handleStop,
    resumeIfAwaitingGeneration,
    isStreaming,
    canStopStreaming,
  } = useConversationStream({
    conversationId,
    setConversation,
    conversationRef,
    onStopError: handleStopError,
  });

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
        const result: Conversation =
          initialData ?? ((await apiGetConversation(id)) as Conversation);
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
              crypto.randomUUID(),
              CompletionMode.ContinueLastUser,
            );
          }
        } else {
          setConversation(result);

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
          showNotification({
            variant: NotificationVariant.Error,
            message: t(ChatI18nKeys.ConversationNotFound),
            requestId: traceId,
          });
        }
        navigate(ROUTES.Root);
      } finally {
        setIsFetching(false);
      }
    },
    [
      navigate,
      restoreSelectedItemId,
      startStream,
      resumeIfAwaitingGeneration,
      updateConversationTitle,
      getGeneration,
      showNotification,
      t,
    ],
  );

  useEffect(() => {
    if (!conversationId) {
      setIsFetching(false);
      return;
    }
    void loadConversation(conversationId, prefetchedConversation);
    /*
     * prefetchedConversation intentionally omitted: it is router state captured at mount,
     * re-running when it changes would re-initialize an already-loaded conversation.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, loadConversation]);

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

  const { toolsMenuItems, onToolToggle, toolConfigurationValue } =
    useToolsMenu();

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
          message: t(RateI18nKeys.LikeToastDescription),
        });
      }
    },
    [pendingDislikeMessageIndex, handleRateMessage, showNotification, t],
  );

  const handleDislikeModalClose = useCallback(() => {
    setPendingDislikeMessageIndex(null);
  }, []);

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
          canStopAssistant={canStopStreaming}
          placeholder={t(ChatI18nKeys.Placeholder)}
          onSelectStarter={handleButtonSelect}
          stoppedGeneratingText={t(ChatI18nKeys.StoppedGenerating)}
          isReadOnly={isReadOnly}
          onDuplicateConversation={handleDuplicateConversation}
          duplicateError={duplicateError ?? undefined}
          isAudioMessageSupported={isAudioMessageSupported}
          conversation={conversation}
          onConversationChange={handleConversationChange}
          inputContent={pendingInputContent.value}
          inputContentRevision={pendingInputContent.revision}
          onInsertText={handleSetPendingInputContent}
          toolsMenuItems={toolsMenuItems}
          onToolToggle={onToolToggle}
          toolsMenuTitle={t(ToolsI18nKeys.MenuTitle)}
          toolsChipLabels={{
            countLabel: (count) => t(ToolsI18nKeys.SelectedCount, { count }),
            removeLabel: (label) => t(ToolsI18nKeys.RemoveTool, { label }),
          }}
          topContent={
            activeScheduledTaskStatus ===
            ActiveScheduledTaskStatus.TaskConversation ? (
              <ScheduledTaskConversationBanner />
            ) : undefined
          }
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
