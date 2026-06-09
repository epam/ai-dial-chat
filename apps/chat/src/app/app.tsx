import {
  lazy,
  memo,
  Suspense,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';
import ConversationPanelView from '../components/ConversationPanel/ConversationPanelView';
import ConversationSourcesPanelView from '../components/ConversationSourcesPanel/ConversationSourcesPanel';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import {
  ROUTES,
  getConversationRoute,
  normalizeConversationId,
} from '../constants/routes';
import { StorageKey } from '../constants/storage';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint';
import useLocalStorage from '../hooks/useLocalStorage';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

const ConversationPage = lazy(async () => {
  const module = await import('../pages/Conversation/Conversation');
  return { default: module.ConversationPage };
});

const App: FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const toggleNav = useCallback(() => setIsNavOpen((prev) => !prev), []);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useLocalStorage(
    StorageKey.ConversationPanelOpen,
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

  // Always close the panel when switching to mobile so a stored desktop `true` doesn't bleed through
  useEffect(() => {
    if (isMobile) closeHistoryPanel();
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchRoot = useMatch(ROUTES.ROOT);
  const matchConversation = useMatch(`${ROUTES.CONVERSATIONS}/*`);
  const isConversationRoute = !!(matchRoot ?? matchConversation);
  const activeConversationId = useMemo(() => {
    const prefix = `${ROUTES.CONVERSATIONS}/`;
    if (!pathname.startsWith(prefix)) return;

    const id = pathname.slice(prefix.length);
    if (!id) return;

    try {
      return normalizeConversationId(decodeURIComponent(id));
    } catch {
      return normalizeConversationId(id);
    }
  }, [pathname]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (isMobile) {
        closeHistoryPanel();
      }

      const conversationRoute = getConversationRoute(id);
      navigate(conversationRoute);
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
};

export default memo(App);
