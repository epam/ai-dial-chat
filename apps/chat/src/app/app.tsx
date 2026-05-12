import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../components/Header/Header';
import { Message } from '../types';
import { getFromLocalStorage } from '../utils/local-storage';

// Lazy load heavy components
const ConversationView = lazy(
  () => import('../components/ConversationView/ConversationView'),
);
const ConversationInput = lazy(() =>
  import('@epam/conversation-input').then((module) => ({
    default: module.ConversationInput,
  })),
);

const MESSAGES_STORAGE_KEY = 'chat-messages';

export function App() {
  const { t } = useTranslation();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear focus from input
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
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = getFromLocalStorage(MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Failed to load messages from localStorage:', error);
    }
    return [];
  });

  const [isAssistantTyping, setIsAssistantTyping] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const handleSend = useCallback(
    (message: string) => {
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsAssistantTyping(true);

      // Simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: t('chat.demoResponse'),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsAssistantTyping(false);

        // Focus input after message is sent for better keyboard navigation
        setTimeout(() => {
          const textarea = inputRef.current?.querySelector('textarea');
          textarea?.focus();
        }, 100);
      }, 500);
    },
    [t],
  );

  return (
    <div className="flex size-full flex-col">
      <Header />
      <main
        id="main-content"
        className="flex flex-1 flex-col overflow-hidden"
        role="main"
      >
        <Suspense
          fallback={
            <div className="flex size-full items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          }
        >
          {messages.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center p-8"
              role="region"
              aria-label="Welcome screen"
            >
              <ConversationInput
                onSend={handleSend}
                welcomeText={t('chat.welcomeText')}
                placeholder={t('chat.placeholder')}
              />
            </div>
          ) : (
            <div ref={inputRef}>
              <ConversationView
                messages={messages}
                onSend={handleSend}
                placeholder={t('chat.placeholder')}
                isAssistantTyping={isAssistantTyping}
              />
            </div>
          )}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
