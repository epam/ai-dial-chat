import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  attachmentsToDtos,
  findDeploymentByIdOrReference,
  getApiErrorDetails,
  getConversationPath,
  getQuickAppConversationStarters,
  getStarterConversationText,
  getStartersFromSchema,
  hasActiveToolConfig,
  useToolsMenu,
} from '@epam/ai-dial-chat-hooks';
import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  useComposerSeed,
  useComposerSeedSource,
} from '@epam/ai-dial-conversation-input';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  NoDataContent,
} from '@epam/ai-dial-ui-kit';
import { IconPrompt, IconTelescope } from '@tabler/icons-react';
import {
  FC,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import CustomViewerFrame from '../../components/CustomViewer/CustomViewerFrame';
import CustomViewerStartGate from '../../components/CustomViewer/CustomViewerStartGate';
import { useDeploymentSelectorOverlay } from '../../components/DeploymentSelector/useDeploymentSelectorOverlay';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import {
  PendingParametersPrompt,
  usePromptSelectorOverlay,
} from '../../components/PromptSelector/usePromptSelectorOverlay';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { useSkillSelectorOverlay } from '../../components/SkillSelector/useSkillSelectorOverlay';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { getConversationRoute } from '../../constants/routes';
import {
  ChatI18nKeys,
  PromptSelectorI18nKeys,
  ToolsI18nKeys,
} from '../../constants/translation-keys';
import { useConversations } from '../../context/ConversationsContext';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  sanitizeIsolatedModelId,
  useIsolatedModelView,
} from '../../context/IsolatedModelViewContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useCustomViewer } from '../../hooks/custom-viewer/useCustomViewer';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useUrlEntityPreselection } from '../../hooks/useUrlEntityPreselection/useUrlEntityPreselection';
import {
  createConversation as apiCreateConversation,
  renameConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { ROUTES } from '../../types/routes';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import { getCleanedLocationTarget } from '../../utils/url-cleanup';

/*
 * TODO: rename page and component
 * TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
 */
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { state, key: locationKey } = useLocation();
  const routeDeploymentId = (state as { deploymentId?: string } | null)
    ?.deploymentId;
  const routePromptContent = (state as { promptContent?: string } | null)
    ?.promptContent;
  const routePendingPrompt = (
    state as { pendingPrompt?: PendingParametersPrompt } | null
  )?.pendingPrompt;
  const routeSkillId = (state as { skillId?: string } | null)?.skillId;
  /*
   * Merges every one-shot "seed the composer" source — a picked prompt's
   * route state, a non-submitting starter selection, and the skill hook's
   * own message/messageRevision push (a mention insertion) — into the one
   * message/messageRevision pair `NewConversationComposer` accepts.
   */
  const {
    message: composerSeedText,
    messageRevision: composerSeedRevision,
    seedMessage: seedComposerText,
  } = useComposerSeed();
  /*
   * A picked prompt is inserted at the caret rather than written to
   * `composerSeed`, so it cannot discard a draft the user has already typed
   * on this screen ([#8754](https://github.com/epam/ai-dial-chat/issues/8754)). The route-state seeding below still
   * replaces, because it arrives with a fresh navigation onto an empty
   * composer.
   */
  const [inputInsertion, setInputInsertion] = useState({
    revision: 0,
    text: '',
  });

  const handleInsertText = useCallback((text: string) => {
    setInputInsertion((prev) => ({ revision: prev.revision + 1, text }));
  }, []);
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    restoreSelectedItemId,
    restoreDefaultSelection,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  const selectedDeployment = useMemo(
    () => findDeploymentByIdOrReference(items, selectedItemId),
    [items, selectedItemId],
  );

  const { refreshConversations } = useConversations();

  const handleCustomViewerConversationCreated = useCallback(
    (createdId: string) => {
      void refreshConversations([createdId]);
      const route = getConversationRoute(createdId);
      if (route !== ROUTES.Root) navigate(route);
    },
    [refreshConversations, navigate],
  );

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
    selectSkillByUrl,
    resetSkillMentions,
    seedSkillMentions,
    recognizeMentionsInInsertion,
  } = useSkillSelectorOverlay({
    isSkillsSupported: selectedDeployment?.features?.skillsSupported === true,
  });

  /* A `/skill-name` written in a prompt's text becomes a real mention once inserted ([#9354](https://github.com/epam/ai-dial-chat/issues/9354)). */
  const handlePromptInsertText = useCallback(
    (text: string) => {
      recognizeMentionsInInsertion(text);
      handleInsertText(text);
    },
    [recognizeMentionsInInsertion, handleInsertText],
  );
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup: promptParametersPopup,
    openParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: handlePromptInsertText });
  const promptsMenuOverlays = useMemo(
    () =>
      renderPromptsOverlay
        ? [
            {
              key: 'prompts',
              title: t(PromptSelectorI18nKeys.AddMenuLabel),
              icon: (
                <IconPrompt
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              renderOverlay: renderPromptsOverlay,
            },
          ]
        : undefined,
    [renderPromptsOverlay, t],
  );

  useComposerSeedSource(skillMessageRevision, () =>
    seedComposerText(skillMessage),
  );
  /*
   * The first message's skills payload comes from the overlay hook. On a
   * successful create this route navigates away and unmounts (clearing the
   * selection with it); on failure the create promise rejects and the
   * selection survives for the retry.
   */
  /*
   * The Skills entry joins the Prompts entry in array order, so it renders
   * below Prompts in the `+` menu; `undefined` when both are flag-disabled
   * keeps the `+` button's empty-menu rule intact.
   */
  const menuOverlays = useMemo(() => {
    const entries = [
      ...(promptsMenuOverlays ?? []),
      ...(skillMenuOverlay ? [skillMenuOverlay] : []),
    ];
    return entries.length > 0 ? entries : undefined;
  }, [promptsMenuOverlays, skillMenuOverlay]);
  const { showErrorNotification } = useNotification();
  const overlay = useOptionalOverlay();
  // TODO: remove in next release
  const {
    isActive: isIsolatedView,
    isNotFound: isIsolatedModelNotFound,
    resolvedDeploymentId: isolatedModelId,
  } = useIsolatedModelView();

  /*
   * Clears one-shot router state while keeping the URL's query string and hash
   * as they are right now (see `getCleanedLocationTarget`), so it can neither
   * wipe a URL parameter that is still pending nor bring back one just removed.
   */
  const clearRouteState = useCallback(() => {
    navigate(getCleanedLocationTarget([]), { replace: true, state: null });
  }, [navigate]);

  const { isDeploymentOverrideActive, isDeploymentPending } =
    useUrlEntityPreselection({
      restoreSelectedItemId,
      selectSkillByUrl,
      seedSkillMentions,
      seedComposerText,
      openParametersPopup,
      routeState: {
        hasDeploymentId: routeDeploymentId != null,
        hasSkillId: routeSkillId != null,
        hasPrompt: routePromptContent != null || routePendingPrompt != null,
      },
      isDisabled: isIsolatedView || overlay != null,
    });
  /*
   * The provider resolves its default in the same commit the listing loads,
   * one commit before a pending `deployment-id` is applied. Until then the
   * selection counts as unknown, so that default neither flashes in the model
   * selector nor fetches viewer or tool data.
   */
  const visibleSelectedItemId = isDeploymentPending ? null : selectedItemId;

  const { viewer: customViewer } = useCustomViewer(visibleSelectedItemId);
  /*
   * Keyed by the deployment and the navigation the user started it in, so
   * selecting another deployment — or pressing New chat again on this same
   * route — drops back to the gate or composer without an effect.
   */
  const customViewerStartKey = `${locationKey}:${visibleSelectedItemId}`;
  const [startedViewerKey, setStartedViewerKey] = useState<string | null>(null);
  const isCustomViewerStarted =
    !!customViewer && startedViewerKey === customViewerStartKey;

  const handleStartCustomViewer = useCallback(() => {
    setStartedViewerKey(customViewerStartKey);
  }, [customViewerStartKey]);

  const hasConsumedRouteDeploymentRef = useRef(false);
  // TODO: remove in next release
  const hasConsumedIsolatedModelIdRef = useRef(false);

  /*
   * Honors a deploymentId passed as router state (by the catalog's "Use in
   * chat" action, or by the overlay's conversation-list bridge opening the
   * composer with a pre-selected deployment) without persisting it as the
   * user's own preference. The state is one-shot, like the prompt state below:
   * `history.state` survives a reload, so leaving it in place would make a
   * refresh keep re-applying a stale pick instead of resolving the configured
   * default.
   *
   * Otherwise, re-resolves selectedItemId back to the user's own preference:
   * having viewed a different conversation may have left a transient,
   * non-persisted model in selectedItemId via restoreSelectedItemId, which
   * must not leak into the next new chat. Skipped while an overlay pending
   * model selection is still awaiting app.tsx's own resolution, so that
   * effect's preselection is not clobbered.
   */
  useEffect(() => {
    if (routeDeploymentId) {
      hasConsumedRouteDeploymentRef.current = true;
      restoreSelectedItemId(routeDeploymentId);
      clearRouteState();
      return;
    }
    /*
     * The clearing navigation above re-runs this effect with no
     * routeDeploymentId. Restoring the default here would immediately undo the
     * selection just applied, so the consumed state is remembered for the
     * lifetime of this mount. A reload or a fresh navigation remounts the
     * route, resetting the flag, and the default resolves normally again.
     */
    if (hasConsumedRouteDeploymentRef.current) return;
    /*
     * A `deployment-id` URL parameter owns the selection while it is pending
     * and after a known id was applied; the default must neither flash first
     * nor undo it. An unknown id settles with the flag off and falls through.
     */
    if (isDeploymentOverrideActive) return;
    /*
     * TODO: remove in next release. Isolated view pins the deployment once it
     * resolves, and must never fall through to the default selection even
     * while still resolving — a briefly-wrong default would visibly flip to
     * the pinned model a moment later.
     */
    if (isIsolatedView) {
      if (isolatedModelId && !hasConsumedIsolatedModelIdRef.current) {
        hasConsumedIsolatedModelIdRef.current = true;
        restoreSelectedItemId(isolatedModelId);
      }
      return;
    }
    if (!overlay?.pendingModelId) {
      restoreDefaultSelection();
    }
  }, [
    restoreSelectedItemId,
    restoreDefaultSelection,
    routeDeploymentId,
    overlay?.pendingModelId,
    clearRouteState,
    isDeploymentOverrideActive,
    isIsolatedView,
    isolatedModelId,
  ]);

  /*
   * Seeds the composer from a prompt the user picked in the catalog. The state
   * is one-shot: clearing it here keeps a later back-navigation to `/` from
   * silently re-injecting stale text, the same reason CatalogView clears its
   * own one-shot `itemId` param.
   */
  useEffect(() => {
    if (routePromptContent == null) return;
    seedComposerText(routePromptContent);
    clearRouteState();
  }, [routePromptContent, clearRouteState, seedComposerText]);

  /*
   * Seeds the "Prompt parameters" popup from a parameterized prompt the user
   * picked via the Catalog page's "Use in chat" action. Same one-shot state
   * clearing as the plain-text case above.
   */
  useEffect(() => {
    if (routePendingPrompt == null) return;
    openParametersPopup(routePendingPrompt);
    clearRouteState();
  }, [routePendingPrompt, openParametersPopup, clearRouteState]);

  /*
   * Seeds the composer's selected skill from a skill the user picked via the
   * catalog's "Use in chat" action. Same one-shot state clearing as the
   * prompt cases above, so a later back-navigation to `/` cannot re-apply a
   * stale pick — and `history.state` surviving a reload cannot keep
   * re-selecting it.
   *
   * `hasConsumedRouteSkillIdRef` mirrors `hasConsumedRouteDeploymentRef`
   * above: `selectSkillByUrl` updates mention state, which changes its own
   * identity on every call, so this effect's dependency array changes again
   * before `navigate`'s state-clearing update (React Router wraps it in
   * `startTransition`, so it is low priority) has a chance to commit —
   * without the ref guard, `selectSkillByUrl` keeps re-firing and starving
   * that transition indefinitely ([#9109](https://github.com/epam/ai-dial-chat/issues/9109)'s render loop).
   */
  const hasConsumedRouteSkillIdRef = useRef(false);
  useEffect(() => {
    if (routeSkillId == null || hasConsumedRouteSkillIdRef.current) return;
    hasConsumedRouteSkillIdRef.current = true;
    selectSkillByUrl(routeSkillId);
    clearRouteState();
  }, [routeSkillId, selectSkillByUrl, clearRouteState]);

  /*
   * This is the "no conversation selected" empty state. Overlay mode must
   * still reach READY_TO_INTERACT here after an inaccessible overlayConversationId
   * falls back to this route, rather than staying pre-interactive forever
   * waiting for a conversation that never loads.
   */
  useEffect(() => {
    overlay?.notifyConversationLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(overlay)]);

  const { toolsMenuItems, onToolToggle, toolConfigurationValue } = useToolsMenu(
    {
      selectedItemId: visibleSelectedItemId,
      selectedDeploymentConfiguration,
      toolIcon: (
        <IconTelescope
          size={DIAL_ICON_SIZE.SM}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      ),
    },
  );

  const deploymentItems: DeploymentItem[] = useMemo(
    () =>
      items.map(
        ({
          id,
          displayName,
          displayVersion,
          iconUrl,
          type,
          inputAttachmentTypes,
        }) => ({
          id,
          displayName: resolveLocalizedText(displayName, language),
          displayVersion,
          iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
          type,
          inputAttachmentTypes,
        }),
      ),
    [items, language],
  );

  const {
    starters: schemaStarters,
    propertyKey: schemaPropertyKey,
    description: schemaDescription,
  } = useMemo(
    () => getStartersFromSchema(selectedDeploymentConfiguration),
    [selectedDeploymentConfiguration],
  );
  const quickAppStarters = useMemo(
    () =>
      getQuickAppConversationStarters(selectedDeployment?.conversationStarters),
    [selectedDeployment?.conversationStarters],
  );
  const usingQuickAppStarters = quickAppStarters.starters.length > 0;
  const activeStarters = usingQuickAppStarters
    ? quickAppStarters.starters
    : schemaStarters;
  const propertyKey = usingQuickAppStarters ? undefined : schemaPropertyKey;
  const description = usingQuickAppStarters ? undefined : schemaDescription;
  const starterIntroText = usingQuickAppStarters
    ? quickAppStarters.introText
    : (schemaDescription ?? quickAppStarters.introText);

  const isInputDisabled = useMemo(
    () =>
      /* A Custom Viewer owns conversation creation, so the chat input stays off. */
      !!customViewer ||
      (usingQuickAppStarters
        ? quickAppStarters.isChatMessageInputDisabled
        : !!selectedDeploymentConfiguration?.isChatMessageInputDisabled),
    [
      customViewer,
      usingQuickAppStarters,
      selectedDeploymentConfiguration,
      quickAppStarters.isChatMessageInputDisabled,
    ],
  );

  const handleCreateConversation = useCallback(
    async (
      message: string,
      attachments: Attachment[],
      chatSettingsValues: NewConversationChatSettings,
    ) => {
      /* A disabled input still sends an already-populated message; a Custom
       * Viewer creates its own conversations, so the chat never does. */
      if (!selectedItemId || customViewer) return;
      const attachmentDtos = attachmentsToDtos(attachments || []);
      const hasToolConfig = hasActiveToolConfig(toolConfigurationValue);
      const skillsForSend = selectedSkills;
      resetSkillMentions();

      let conversation: ConversationResponseDto;
      try {
        conversation = await apiCreateConversation(
          message,
          selectedItemId,
          attachmentDtos,
          hasToolConfig ? toolConfigurationValue : undefined,
          undefined,
          skillsForSend,
        );
      } catch (err) {
        seedSkillMentions(message, skillsForSend);
        throw err;
      }

      // TODO: remove in next release
      const isolatedName =
        isIsolatedView && isolatedModelId
          ? `isolated_${sanitizeIsolatedModelId(isolatedModelId)}`
          : null;
      const savedConversation = {
        ...conversation,
        ...(isolatedName ? { name: isolatedName } : {}),
        prompt: chatSettingsValues.systemPrompt,
        temperature: chatSettingsValues.temperature,
        responseFormat: chatSettingsValues.responseFormat,
      } as ConversationResponseDto;

      try {
        if (isolatedName) {
          await renameConversation(
            getConversationPath(conversation.id),
            isolatedName,
          );
        }
        await saveConversation(
          getConversationPath(conversation.id),
          savedConversation,
        );
      } catch (err) {
        /*
         * The conversation already exists on the server at this point, so
         * navigate to it instead of restoring the composer — restoring it
         * would let the user retry and create a duplicate conversation.
         */
        navigate(getConversationRoute(conversation.id), {
          state: { conversation: savedConversation },
        });
        throw err;
      }

      navigate(getConversationRoute(conversation.id), {
        state: { conversation: savedConversation },
      });
    },
    [
      navigate,
      selectedItemId,
      customViewer,
      toolConfigurationValue,
      isIsolatedView,
      isolatedModelId,
      selectedSkills,
      resetSkillMentions,
      seedSkillMentions,
    ],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      if (starter['dial:widgetOptions'].submit) {
        const text = getStarterConversationText(starter, description);
        if (!selectedItemId) {
          return;
        }

        const starterConfig = propertyKey
          ? { [propertyKey]: starter.const }
          : undefined;
        const mergedConfigurationValue = {
          ...starterConfig,
          ...toolConfigurationValue,
        };
        const hasConfig = Object.keys(mergedConfigurationValue).length > 0;
        const createAndNavigate = async () => {
          try {
            const conversation = await apiCreateConversation(
              text,
              selectedItemId,
              [],
              hasConfig ? mergedConfigurationValue : undefined,
            );
            // TODO: remove in next release
            if (isIsolatedView && isolatedModelId) {
              await renameConversation(
                getConversationPath(conversation.id),
                `isolated_${sanitizeIsolatedModelId(isolatedModelId)}`,
              );
            }
            navigate(getConversationRoute(conversation.id));
          } catch (err) {
            const { message: errorMessage, traceId } =
              await getApiErrorDetails(err);
            showErrorNotification({
              message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
              requestId: traceId,
            });
          }
        };

        void createAndNavigate();
      } else {
        const text = getStarterConversationText(starter, description);
        seedComposerText(text);
      }
    },
    [
      description,
      propertyKey,
      selectedItemId,
      navigate,
      seedComposerText,
      showErrorNotification,
      t,
      toolConfigurationValue,
      isIsolatedView,
      isolatedModelId,
    ],
  );

  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();

  // TODO: remove in next release
  if (isIsolatedModelNotFound) {
    return (
      <div className="flex size-full items-center justify-center">
        <NoDataContent
          title={t(ChatI18nKeys.IsolatedModelNotFoundTitle)}
          description={t(ChatI18nKeys.IsolatedModelNotFoundDescription)}
          live
        />
      </div>
    );
  }

  if (customViewer && isCustomViewerStarted) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <CustomViewerFrame
          viewer={customViewer}
          shouldAutoFocus
          onConversationCreated={handleCustomViewerConversationCreated}
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <NewConversationComposer
        deployments={deploymentItems}
        selectedDeploymentId={visibleSelectedItemId}
        onDeploymentChange={setSelectedItemId}
        isModelSelectorLoading={isLoading || isDeploymentPending}
        modelSelectorError={error}
        selectedDeployment={selectedDeployment}
        isInputDisabled={isInputDisabled}
        placeholder={t(ChatI18nKeys.Placeholder)}
        introText={starterIntroText}
        message={composerSeedText}
        messageRevision={composerSeedRevision}
        onChange={onDraftChange}
        inputInsertion={inputInsertion}
        onCreateConversation={handleCreateConversation}
        modelPickerOverlay={renderOverlay}
        menuOverlays={menuOverlays}
        activeMentions={activeMentions}
        onBackspaceAtCaret={onBackspaceAtCaret}
        caretPositionOverride={caretPositionOverride}
        isSkillUnsupported={isSkillUnsupported}
        commandMenu={commandMenu}
        toolsMenuItems={toolsMenuItems}
        onToolToggle={onToolToggle}
        toolsMenuTitle={t(ToolsI18nKeys.MenuTitle)}
        toolsChipLabels={{
          removeLabel: (label) => t(ToolsI18nKeys.RemoveTool, { label }),
          stateOnLabel: t(ToolsI18nKeys.StateOn),
          stateOffLabel: t(ToolsI18nKeys.StateOff),
        }}
      >
        {customViewer ? (
          <CustomViewerStartGate
            viewerTitle={customViewer.title}
            onStart={handleStartCustomViewer}
          />
        ) : (
          <StarterButtons
            starters={activeStarters}
            onSelect={handleStarterSelect}
          />
        )}
      </NewConversationComposer>
      {catalogModal}
      {promptCatalogModal}
      {promptParametersPopup}
      {skillCatalogModal}
      {skillDetailsPanel}
    </Suspense>
  );
};

export default memo(ConversationRoute);
