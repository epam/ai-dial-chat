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
import { Route, Routes, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import { useConversation } from '../context/ConversationContext';

const ConversationInput = lazy(() =>
  import('@epam/conversation-input').then((module) => ({
    default: module.ConversationInput,
  })),
);
const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));
const ConversationPage = lazy(() =>
  import('../components/ConversationPage/ConversationPage').then((m) => ({
    default: m.ConversationPage,
  })),
);

const routeFallback = (
  <div className="flex size-full items-center justify-center">
    <div className="text-gray-500 dark:text-gray-400">Loading...</div>
  </div>
);

const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createConversation } = useConversation();
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
        const id = await createConversation(message);
        navigate(`/conversations/${id}`);
      } finally {
        setIsSending(false);
      }
    },
    [createConversation, navigate, isSending],
  );

  return (
    <div ref={inputRef} className="flex flex-1 flex-col overflow-hidden">
      <Suspense fallback={routeFallback}>
        <div
          className="flex h-full flex-col items-center justify-center p-8"
          role="region"
          aria-label="Welcome screen"
        >
          <ConversationInput
            onSend={handleSend}
            welcomeText={t('chat.welcomeText')}
            placeholder={t('chat.placeholder')}
            typography={{ welcomeClassName: 'dial-display2-text' }}
          />
        </div>
      </Suspense>
    </div>
  );
};

function App() {
  return (
    <div className="flex size-full flex-row">
      <Navigation />
      <main
        id="main-content"
        role="main"
        className="flex min-h-0 flex-1 flex-col bg-layer-1"
      >
        <Header />
        <Routes>
          <Route path="/" element={<ConversationRoute />} />
          <Route
            path="/catalog"
            element={
              <Suspense fallback={routeFallback}>
                <CatalogView />
              </Suspense>
            }
          />
          <Route
            path="/conversations/:conversationId"
            element={
              <Suspense fallback={routeFallback}>
                <ConversationPage />
              </Suspense>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
