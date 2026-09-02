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
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  NoDataContent,
} from '@epam/ai-dial-ui-kit';
import { IconTelescope } from '@tabler/icons-react';
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
import { useDeploymentSelectorOverlay } from '../../components/DeploymentSelector/useDeploymentSelectorOverlay';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import {
  PendingParametersPrompt,
  usePromptSelectorOverlay,
} from '../../components/PromptSelector/usePromptSelectorOverlay';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { getConversationRoute } from '../../constants/routes';
import {
  ChatI18nKeys,
  PromptSelectorI18nKeys,
  ToolsI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  sanitizeIsolatedModelId,
  useIsolatedModelView,
} from '../../context/IsolatedModelViewContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import {
  createConversation as apiCreateConversation,
  renameConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';

/*
 * TODO: rename page and component
 * TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
 */
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const routeDeploymentId = (state as { deploymentId?: string } | null)
    ?.deploymentId;
  const routePromptContent = (state as { promptContent?: string } | null)
    ?.promptContent;
  const routePendingPrompt = (
    state as { pendingPrompt?: PendingParametersPrompt } | null
  )?.pendingPrompt;
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const [inputMessageRevision, setInputMessageRevision] = useState(0);

  const handleInsertText = useCallback((text: string) => {
    setInputMessage(text);
    setInputMessageRevision((prev) => prev + 1);
  }, []);
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup: promptParametersPopup,
    openParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: handleInsertText });
  const { showErrorNotification } = useNotification();
  const overlay = useOptionalOverlay();
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
  // TODO: remove in next release
  const {
    isActive: isIsolatedView,
    isNotFound: isIsolatedModelNotFound,
    resolvedDeploymentId: isolatedModelId,
  } = useIsolatedModelView();

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
      navigate(pathname, { replace: true, state: null });
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
    navigate,
    pathname,
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
    setInputMessage(routePromptContent);
    navigate(pathname, { replace: true, state: null });
  }, [routePromptContent, navigate, pathname]);

  /*
   * Seeds the "Prompt parameters" popup from a parameterized prompt the user
   * picked via the Catalog page's "Use in chat" action. Same one-shot state
   * clearing as the plain-text case above.
   */
  useEffect(() => {
    if (routePendingPrompt == null) return;
    openParametersPopup(routePendingPrompt);
    navigate(pathname, { replace: true, state: null });
  }, [routePendingPrompt, openParametersPopup, navigate, pathname]);

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
      selectedItemId,
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

  const selectedDeployment = useMemo(
    () => findDeploymentByIdOrReference(items, selectedItemId),
    [items, selectedItemId],
  );

  const deploymentItems: DeploymentItem[] = useMemo(
    () =>
      items.map(({ id, displayName, iconUrl, type, inputAttachmentTypes }) => ({
        id,
        displayName: resolveLocalizedText(displayName, language),
        iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
        type,
        inputAttachmentTypes,
      })),
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
      usingQuickAppStarters
        ? quickAppStarters.isChatMessageInputDisabled
        : !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
    [
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
      if (!selectedItemId) return;
      const attachmentDtos = attachmentsToDtos(attachments || []);
      const hasToolConfig = hasActiveToolConfig(toolConfigurationValue);
      const conversation = await apiCreateConversation(
        message,
        selectedItemId,
        attachmentDtos,
        hasToolConfig ? toolConfigurationValue : undefined,
      );
      // TODO: remove in next release
      const isolatedName =
        isIsolatedView && isolatedModelId
          ? `isolated_${sanitizeIsolatedModelId(isolatedModelId)}`
          : null;
      if (isolatedName) {
        await renameConversation(
          getConversationPath(conversation.id),
          isolatedName,
        );
      }
      const savedConversation = {
        ...conversation,
        ...(isolatedName ? { name: isolatedName } : {}),
        prompt: chatSettingsValues.systemPrompt,
        temperature: chatSettingsValues.temperature,
        responseFormat: chatSettingsValues.responseFormat,
      } as ConversationResponseDto;
      await saveConversation(
        getConversationPath(conversation.id),
        savedConversation,
      );
      navigate(getConversationRoute(conversation.id), {
        state: { conversation: savedConversation },
      });
    },
    [
      navigate,
      selectedItemId,
      toolConfigurationValue,
      isIsolatedView,
      isolatedModelId,
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
        setInputMessage(text);
      }
    },
    [
      description,
      propertyKey,
      selectedItemId,
      navigate,
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

  return (
    <Suspense fallback={<RouteFallback />}>
      <NewConversationComposer
        deployments={deploymentItems}
        selectedDeploymentId={selectedItemId}
        onDeploymentChange={setSelectedItemId}
        isModelSelectorLoading={isLoading}
        modelSelectorError={error}
        selectedDeployment={selectedDeployment}
        isInputDisabled={isInputDisabled}
        placeholder={t(ChatI18nKeys.Placeholder)}
        introText={starterIntroText}
        message={inputMessage}
        messageRevision={inputMessageRevision}
        onCreateConversation={handleCreateConversation}
        modelPickerOverlay={renderOverlay}
        promptsMenuOverlay={renderPromptsOverlay}
        promptsMenuTitle={t(PromptSelectorI18nKeys.AddMenuLabel)}
        toolsMenuItems={toolsMenuItems}
        onToolToggle={onToolToggle}
        toolsMenuTitle={t(ToolsI18nKeys.MenuTitle)}
        toolsChipLabels={{
          removeLabel: (label) => t(ToolsI18nKeys.RemoveTool, { label }),
        }}
      >
        <StarterButtons
          starters={activeStarters}
          onSelect={handleStarterSelect}
        />
      </NewConversationComposer>
      {catalogModal}
      {promptCatalogModal}
      {promptParametersPopup}
    </Suspense>
  );
};

export default memo(ConversationRoute);
