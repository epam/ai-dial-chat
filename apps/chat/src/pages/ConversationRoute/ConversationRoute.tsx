import type { Attachment, StarterOption } from '@epam/ai-dial-chat-shared';
import {
  FC,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { getConversationRoute } from '../../constants/routes';
import {
  ChatI18nKeys,
  DeploymentsI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import {
  getStarterPopulateText,
  getStartersFromSchema,
} from '../../utils/starter-option';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

// TODO: rename page and component
// TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const inputRef = useRef<HTMLDivElement>(null);
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  const { starters, propertyKey, description } = useMemo(
    () => getStartersFromSchema(selectedDeploymentConfiguration),
    [selectedDeploymentConfiguration],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = useCallback(
    async (message: string, attachments: Attachment[]) => {
      if (isSending || !selectedItemId) return;
      setIsSending(true);
      try {
        const attachmentDtos = await attachmentsToDtos(attachments || []);
        const conversation = await apiCreateConversation(
          message,
          selectedItemId,
          attachmentDtos,
          configurationValue,
        );
        navigate(getConversationRoute(conversation.id));
      } finally {
        setIsSending(false);
      }
    },
    [navigate, isSending, selectedItemId],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      // For button widgets the description is the message content;
      // for starter widgets fall back to populateText / title.
      const text = description ?? getStarterPopulateText(starter);

      if (starter['dial:widgetOptions'].submit) {
        const configurationValue = propertyKey
          ? { [propertyKey]: starter.const }
          : undefined;
        void apiCreateConversation(
          text,
          selectedItemId,
          [],
          undefined,
          configurationValue,
        ).then((conversation) => {
          navigate(getConversationRoute(conversation.id));
        });
      } else {
        setInputMessage(text);
      }
    },
    [description, propertyKey, selectedItemId, navigate],
  );

  const executeStarter = useCallback(
    (
      text: string,
      submit: boolean,
      configurationValue?: Record<string, unknown>,
    ) => {
      if (submit) {
        void handleSend(text, undefined, configurationValue);
      } else {
        setPopulateText(text);
      }
    },
    [handleSend],
  );

  const handleStarterSelect = useCallback(
    (
      text: string,
      submit: boolean,
      confirmationMessage: string | null,
      configurationValue?: Record<string, unknown>,
    ) => {
      if (confirmationMessage) {
        setPendingStarter({
          text,
          submit,
          confirmationMessage,
          configurationValue,
        });
      } else {
        executeStarter(text, submit, configurationValue);
      }
    },
    [executeStarter],
  );

  const handleConfirmStarter = useCallback(() => {
    if (pendingStarter) {
      executeStarter(
        pendingStarter.text,
        pendingStarter.submit,
        pendingStarter.configurationValue,
      );
      setPendingStarter(null);
    }
  }, [pendingStarter, executeStarter]);

  const handleCancelStarter = useCallback(() => {
    setPendingStarter(null);
  }, []);

  return (
    <div ref={inputRef} className="flex flex-1 flex-col overflow-y-auto">
      <Suspense fallback={<RouteFallback />}>
        <div
          className="flex h-full flex-col items-center justify-center p-4 desktop:p-8"
          role="region"
          aria-label={t(ChatI18nKeys.WelcomeScreen)}
        >
          <ConversationInput
            onSend={handleSend}
            message={inputMessage}
            welcomeText={t(ChatI18nKeys.WelcomeText)}
            placeholder={t(ChatI18nKeys.Placeholder)}
            typography={{ welcomeClassName: 'dial-display2-text' }}
            deployments={items}
            selectedDeploymentId={selectedItemId}
            onDeploymentChange={setSelectedItemId}
            modelSelectorLabels={{
              ariaLabel: t(DeploymentsI18nKeys.SelectorAriaLabel),
              loading: isLoading
                ? t(DeploymentsI18nKeys.SelectorLoading)
                : undefined,
              error: error ? t(DeploymentsI18nKeys.SelectorError) : undefined,
              empty:
                !isLoading && !error && items.length === 0
                  ? t(DeploymentsI18nKeys.SelectorEmpty)
                  : undefined,
            }}
            sendLabel={t(ChatI18nKeys.SendMessage)}
            stopLabel={t(ChatI18nKeys.StopStreaming)}
          />
          <StarterButtons starters={starters} onSelect={handleStarterSelect} />
        </div>
      </Suspense>
      <DialConfirmationPopup
        open={!!pendingStarter}
        header={t(ChatI18nKeys.StarterConfirmationTitle)}
        description={pendingStarter?.confirmationMessage}
        onConfirm={handleConfirmStarter}
        onCancel={handleCancelStarter}
        onClose={handleCancelStarter}
      />
    </div>
  );
};

export default ConversationRoute;
