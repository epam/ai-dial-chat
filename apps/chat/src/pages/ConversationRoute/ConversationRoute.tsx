import type { ConversationResponseDto } from '@epam/ai-dial-chat-api-client';
import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  FC,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { useDeploymentSelectorOverlay } from '../../components/DeploymentSelector/useDeploymentSelectorOverlay';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import { usePromptSelectorOverlay } from '../../components/PromptSelector/usePromptSelectorOverlay';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { getConversationRoute } from '../../constants/routes';
import {
  ChatI18nKeys,
  PromptSelectorI18nKeys,
  ToolsI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { useToolsMenu } from '../../hooks/conversation/useToolsMenu';
import { useLanguage } from '../../hooks/language/useLanguage';
import { getApiErrorDetails } from '../../server-api/api-error';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { resolveLocalizedText } from '../../utils/locale';
import { hasActiveToolConfig } from '../../utils/message-utils';
import { getQuickAppConversationStarters } from '../../utils/quick-app-conversation-starters';
import {
  getStarterConversationText,
  getStartersFromSchema,
} from '../../utils/starter-option';

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
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const [inputMessageRevision, setInputMessageRevision] = useState(0);

  const handleInsertText = useCallback((text: string) => {
    setInputMessage(text);
    setInputMessageRevision((prev) => prev + 1);
  }, []);
  const { showNotification } = useNotification();
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

  /*
   * Honors a deploymentId passed as router state (e.g. by the overlay's
   * conversation-list bridge opening the composer with a pre-selected
   * deployment) without persisting it as the user's own preference.
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
      restoreSelectedItemId(routeDeploymentId);
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
   * This is the "no conversation selected" empty state. Overlay mode must
   * still reach READY_TO_INTERACT here after an inaccessible overlayConversationId
   * falls back to this route, rather than staying pre-interactive forever
   * waiting for a conversation that never loads.
   */
  useEffect(() => {
    overlay?.notifyConversationLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(overlay)]);

  const { toolsMenuItems, onToolToggle, toolConfigurationValue } =
    useToolsMenu();

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
      const savedConversation = {
        ...conversation,
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
    [navigate, selectedItemId, toolConfigurationValue],
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
            navigate(getConversationRoute(conversation.id));
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
      showNotification,
      t,
      toolConfigurationValue,
    ],
  );

  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup: promptParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: handleInsertText });

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
          countLabel: (count) => t(ToolsI18nKeys.SelectedCount, { count }),
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
