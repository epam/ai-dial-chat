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
  CatalogI18nKeys,
  ChatI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useModels } from '../../context/ModelsContext';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getStarterPopulateText } from '../../utils/starter-option';

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
  const { items, selectedItemId, setSelectedItemId, isLoading, error } =
    useDeployments();
  const { selectedModelConfiguration } = useModels();

  const starters = useMemo<StarterOption[]>(() => {
    const oneOf = selectedModelConfiguration?.properties?.starter?.oneOf;

    if (!Array.isArray(oneOf)) return [];
    return oneOf as StarterOption[];
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
    async (message: string, attachments: Attachment[]) => {
      if (isSending || !selectedItemId) return;
      setIsSending(true);
      try {
        const attachmentDtos = await attachmentsToDtos(attachments);
        const conversation = await apiCreateConversation(
          message,
          selectedItemId,
          attachmentDtos,
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
      const text = getStarterPopulateText(starter);
      if (starter['dial:widgetOptions'].submit) {
        void handleSend(text, []);
      } else {
        setInputMessage(text);
      }
    },
    [handleSend],
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
            catalogItems={items}
            selectedCatalogItemId={selectedItemId}
            onSelectedCatalogItemChange={setSelectedItemId}
            modelSelectorAriaLabel={t(CatalogI18nKeys.SelectorAriaLabel)}
            modelSelectorLoadingLabel={
              isLoading ? t(CatalogI18nKeys.SelectorLoading) : undefined
            }
            modelSelectorErrorLabel={
              error ? t(CatalogI18nKeys.SelectorError) : undefined
            }
            modelSelectorEmptyLabel={
              !isLoading && !error && items.length === 0
                ? t(CatalogI18nKeys.SelectorEmpty)
                : undefined
            }
          />
          <StarterButtons starters={starters} onSelect={handleStarterSelect} />
        </div>
      </Suspense>
    </div>
  );
};

export default ConversationRoute;
