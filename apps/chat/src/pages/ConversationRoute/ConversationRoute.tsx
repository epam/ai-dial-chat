import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import { getConversationRoute } from '../../constants/routes';
import { ChatI18nKeys } from '../../constants/translation-keys';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';

const ConversationInput = lazy(() =>
  import('@epam/conversation-input').then((module) => ({
    default: module.ConversationInput,
  })),
);

// TODO: rename page and component
// TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

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
    async (message: string) => {
      if (isSending) return;
      setIsSending(true);
      try {
        const conversation = await apiCreateConversation(message);
        navigate(getConversationRoute(conversation.id));
      } finally {
        setIsSending(false);
      }
    },
    [navigate, isSending],
  );

  return (
    <div ref={inputRef} className="flex flex-1 flex-col overflow-hidden">
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
          />
        </div>
      </Suspense>
    </div>
  );
};

export default ConversationRoute;
