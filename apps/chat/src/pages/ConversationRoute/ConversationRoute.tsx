import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
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
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeploymentSelectorOverlay } from '../../components/DeploymentSelector/useDeploymentSelectorOverlay';
import NewConversationComposer, {
  type NewConversationChatSettings,
} from '../../components/NewConversationComposer/NewConversationComposer';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { CONVERSATION_ROUTE_INPUT_STYLES } from '../../constants/input-styles';
import { getConversationRoute } from '../../constants/routes';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useOptionalOverlay } from '../../context/overlay/OverlayContext';
import { getApiErrorMessage } from '../../server-api/api-error';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
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
  const navigate = useNavigate();
  const { state } = useLocation();
  const routeDeploymentId = (state as { deploymentId?: string } | null)
    ?.deploymentId;
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const { showNotification } = useNotification();
  const overlay = useOptionalOverlay();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    restoreSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  /*
   * Honors a deploymentId passed as router state (e.g. by the overlay's
   * conversation-list bridge opening the composer with a pre-selected
   * deployment) without persisting it as the user's own preference.
   */
  useEffect(() => {
    if (routeDeploymentId) {
      restoreSelectedItemId(routeDeploymentId);
    }
  }, [restoreSelectedItemId, routeDeploymentId]);

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

  const selectedDeployment = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const deploymentItems: DeploymentItem[] = useMemo(
    () =>
      items.map(({ id, displayName, iconUrl, type, inputAttachmentTypes }) => ({
        id,
        displayName,
        iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
        type,
        inputAttachmentTypes,
      })),
    [items],
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
      const conversation = await apiCreateConversation(
        message,
        selectedItemId,
        attachmentDtos,
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
    [navigate, selectedItemId],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      if (starter['dial:widgetOptions'].submit) {
        const text = getStarterConversationText(starter, description);
        if (!selectedItemId) {
          return;
        }

        const configurationValue = propertyKey
          ? { [propertyKey]: starter.const }
          : undefined;
        const createAndNavigate = async () => {
          try {
            const conversation = await apiCreateConversation(
              text,
              selectedItemId,
              [],
              configurationValue,
            );
            navigate(getConversationRoute(conversation.id));
          } catch (err) {
            const errorMessage = await getApiErrorMessage(err);
            showNotification({
              variant: NotificationVariant.Error,
              message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
            });
          }
        };

        void createAndNavigate();
      } else {
        const text = getStarterConversationText(starter, description);
        setInputMessage(text);
      }
    },
    [description, propertyKey, selectedItemId, navigate, showNotification, t],
  );

  const { renderOverlay, catalogModal } = useDeploymentSelectorOverlay();

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
        inputStyles={CONVERSATION_ROUTE_INPUT_STYLES}
        onCreateConversation={handleCreateConversation}
        modelPickerOverlay={renderOverlay}
      >
        <StarterButtons
          starters={activeStarters}
          onSelect={handleStarterSelect}
        />
      </NewConversationComposer>
      {catalogModal}
    </Suspense>
  );
};

export default memo(ConversationRoute);
