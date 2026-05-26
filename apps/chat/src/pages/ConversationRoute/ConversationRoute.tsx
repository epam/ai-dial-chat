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
import { ChatI18nKeys } from '../../constants/translation-keys';
import { useModels } from '../../context/ModelsContext';
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
  const { selectedModelConfiguration } = useModels();

  const { starters, propertyKey, description } = useMemo(
    () => getStartersFromSchema(selectedModelConfiguration),
    [selectedModelConfiguration],
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
      if (isSending) return;
      setIsSending(true);
      try {
        const attachmentDtos = await attachmentsToDtos(attachments);
        const customContent = attachmentDtos?.length
          ? { attachments: attachmentDtos }
          : undefined;
        const conversation = await apiCreateConversation(
          message,
          customContent,
        );
        navigate(getConversationRoute(conversation.id));
      } finally {
        setIsSending(false);
      }
    },
    [navigate, isSending],
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
        const customContent = configurationValue
          ? { configuration_value: configurationValue }
          : undefined;
        void apiCreateConversation(text, customContent).then((conversation) => {
          navigate(getConversationRoute(conversation.id));
        });
      } else {
        setInputMessage(text);
      }
    },
    [navigate, propertyKey, description],
  );

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
            message={inputMessage}
            welcomeText={t(ChatI18nKeys.WelcomeText)}
            placeholder={t(ChatI18nKeys.Placeholder)}
            typography={{ welcomeClassName: 'dial-display2-text' }}
          />
          <StarterButtons starters={starters} onSelect={handleStarterSelect} />
        </div>
      </Suspense>
    </div>
  );
};

export default ConversationRoute;
