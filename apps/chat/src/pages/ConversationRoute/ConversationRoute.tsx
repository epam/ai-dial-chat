import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import { FC, memo, Suspense, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  getStarterPopulateText,
  getStartersFromSchema,
} from '../../utils/starter-option';

/*
 * TODO: rename page and component
 * TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
 */
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const { showNotification } = useNotification();
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

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

  const { starters, propertyKey, description } = useMemo(
    () => getStartersFromSchema(selectedDeploymentConfiguration),
    [selectedDeploymentConfiguration],
  );
  const quickAppStarters = useMemo(
    () =>
      getQuickAppConversationStarters(selectedDeployment?.conversationStarters),
    [selectedDeployment?.conversationStarters],
  );
  const activeStarters =
    starters.length > 0 ? starters : quickAppStarters.starters;
  const starterIntroText = description ?? quickAppStarters.introText;

  const isInputDisabled = useMemo(
    () =>
      !!selectedDeploymentConfiguration?.isChatMessageInputDisabled ||
      quickAppStarters.isChatMessageInputDisabled,
    [
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
        const text = description ?? getStarterPopulateText(starter);
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
        const text = description ?? getStarterPopulateText(starter);
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
