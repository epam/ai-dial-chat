import type { Attachment, StarterOption } from '@epam/ai-dial-chat-shared';
import { DialConfirmationPopup } from '@epam/ai-dial-ui-kit';
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
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useModels } from '../../context/ModelsContext';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';

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
  const [populateText, setPopulateText] = useState<string | undefined>();
  const [pendingStarter, setPendingStarter] = useState<{
    text: string;
    submit: boolean;
    confirmationMessage: string;
    configurationValue?: Record<string, unknown>;
  } | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const { selectedModelConfiguration } = useModels();

  const { starters, startersPropertyKey } = useMemo<{
    starters: StarterOption[];
    startersPropertyKey: string | undefined;
  }>(() => {
    const properties = selectedModelConfiguration?.properties;
    const key = properties?.starter
      ? 'starter'
      : properties?.button
        ? 'button'
        : undefined;
    const oneOf = key ? properties?.[key]?.oneOf : undefined;
    if (!Array.isArray(oneOf)) {
      return { starters: [], startersPropertyKey: undefined };
    }
    return { starters: oneOf as StarterOption[], startersPropertyKey: key };
  }, [selectedModelConfiguration]);

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
    async (
      message: string,
      attachments?: Attachment[],
      configurationValue?: Record<string, unknown>,
    ) => {
      if (isSending) return;
      setIsSending(true);
      try {
        const attachmentDtos = await attachmentsToDtos(attachments || []);
        const conversation = await apiCreateConversation(
          message,
          attachmentDtos,
          configurationValue,
        );
        navigate(getConversationRoute(conversation.id));
      } finally {
        setIsSending(false);
      }
    },
    [navigate, isSending],
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
          className="flex h-full flex-col items-center justify-center p-8"
          role="region"
          aria-label="Welcome screen"
        >
          <ConversationInput
            onSend={handleSend}
            welcomeText={t(ChatI18nKeys.WelcomeText)}
            placeholder={t(ChatI18nKeys.Placeholder)}
            typography={{ welcomeClassName: 'dial-display2-text' }}
            populateText={populateText}
          />
          <StarterButtons
            starters={starters}
            onSelect={handleStarterSelect}
            propertyKey={startersPropertyKey}
          />
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
