import {
  ConversationHistoryPanel,
  type ConversationHistoryItem,
} from '@epam/ai-dial-conversation-history';
import { lazy, Suspense, useCallback, useState } from 'react';
import { Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConversationSourcesPanelView from '../components/ConversationSourcesPanel/ConversationSourcesPanelView.js';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { ROUTES, getConversationRoute } from '../constants/routes';
import { ConversationHistoryI18nKeys } from '../constants/translation-keys.js';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint.js';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

const ConversationPage = lazy(async () => {
  const module = await import('../pages/Conversation/Conversation');
  return { default: module.ConversationPage };
});

const EMPTY_CONVERSATIONS: ConversationHistoryItem[] = [];

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const toggleNav = useCallback(() => setIsNavOpen((prev) => !prev), []);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const toggleHistoryPanel = useCallback(
    () => setIsHistoryPanelOpen((prev) => !prev),
    [],
  );
  const closeHistoryPanel = useCallback(() => setIsHistoryPanelOpen(false), []);

  const matchRoot = useMatch(ROUTES.ROOT);
  const matchConversation = useMatch('/conversations/:id');
  const isConversationRoute = !!(matchRoot ?? matchConversation);
  const activeConversationId = matchConversation?.params.id;

  const handleSelectConversation = useCallback(
    (id: string) => {
      navigate(getConversationRoute(id));
      if (isMobile) closeHistoryPanel();
    },
    [navigate, isMobile, closeHistoryPanel],
  );

  return (
    <div className="flex size-full flex-row">
      <Navigation isOpen={isNavOpen} onClose={closeNav} />

      <ConversationHistoryPanel
        conversations={EMPTY_CONVERSATIONS}
        isOpen={isHistoryPanelOpen}
        onSelectConversation={handleSelectConversation}
        activeConversationId={activeConversationId}
        title={t(ConversationHistoryI18nKeys.Title)}
        emptyLabel={t(ConversationHistoryI18nKeys.Empty)}
        formatDate={(iso: string) => new Date(iso).toLocaleDateString()}
        onBackdropClick={isMobile ? closeHistoryPanel : undefined}
        className={
          isMobile ? 'fixed inset-y-0 left-0 z-50 w-[280px]' : undefined
        }
      />

      <main
        id="main-content"
        role="main"
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-layer-1"
      >
        <Header
          onMenuToggle={toggleNav}
          isHistoryPanelOpen={isHistoryPanelOpen}
          onHistoryPanelToggle={toggleHistoryPanel}
        />
        <Routes>
          <Route path={ROUTES.ROOT} element={<ConversationRoute />} />
          <Route
            path={ROUTES.CATALOG}
            element={
              <Suspense fallback={<RouteFallback />}>
                <CatalogView />
              </Suspense>
            }
          />
          <Route
            path="/conversations/*"
            element={
              <Suspense fallback={<RouteFallback />}>
                <ConversationPage />
              </Suspense>
            }
          />
        </Routes>
      </main>
      {isConversationRoute && <ConversationSourcesPanelView />}
    </div>
  );
}

export default App;
