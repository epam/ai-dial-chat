import { lazy, Suspense, useCallback, useState } from 'react';
import { Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import ConversationPanelView from '../components/ConversationPanel/ConversationPanelView.js';
import ConversationSourcesPanelView from '../components/ConversationSourcesPanel/ConversationSourcesPanelView.js';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { ROUTES, getConversationRoute } from '../constants/routes';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint.js';
import useLocalStorage from '../hooks/useLocalStorage';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

const ConversationPage = lazy(async () => {
  const module = await import('../pages/Conversation/Conversation');
  return { default: module.ConversationPage };
});

function App() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const toggleNav = useCallback(() => setIsNavOpen((prev) => !prev), []);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useLocalStorage(
    'conversationPanelOpen',
    false,
  );
  const toggleHistoryPanel = useCallback(
    () => setIsHistoryPanelOpen(!isHistoryPanelOpen),
    [isHistoryPanelOpen, setIsHistoryPanelOpen],
  );
  const closeHistoryPanel = useCallback(
    () => setIsHistoryPanelOpen(false),
    [setIsHistoryPanelOpen],
  );

  const matchRoot = useMatch(ROUTES.ROOT);
  const matchConversation = useMatch('/conversations/*');
  const isConversationRoute = !!(matchRoot ?? matchConversation);
  const activeConversationId = matchConversation?.params['*'];

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

      <ConversationPanelView
        isOpen={isHistoryPanelOpen}
        activeConversationId={activeConversationId}
        onClose={closeHistoryPanel}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => navigate(ROUTES.ROOT)}
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
