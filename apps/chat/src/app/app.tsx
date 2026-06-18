import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FC,
} from 'react';
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';
import ConversationPanelView from '../components/ConversationPanel/ConversationPanelView';
import ConversationSourcesPanel from '../components/ConversationSourcesPanel/ConversationSourcesPanel';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import {
  getConversationRoute,
  normalizeConversationId,
} from '../constants/routes';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint';
import useLocalStorage from '../hooks/useLocalStorage';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';
import { ROUTES } from '../types/routes';
import { StorageKey } from '../types/storage-key';

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

  const matchRoot = useMatch(ROUTES.Root);
  const matchConversation = useMatch(`${ROUTES.Conversations}/*`);
  const isConversationRoute = !!(matchRoot ?? matchConversation);
  const activeConversationId = useMemo(() => {
    const prefix = `${ROUTES.Conversations}/`;
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
        onNewChat={() => navigate(ROUTES.Root)}
      />

      <main
        id="main-content"
        role="main"
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-layer-1"
      >
        <Header
          onMenuToggle={toggleNav}
          isConversationPanelOpen={isHistoryPanelOpen}
          onConversationPanelToggle={toggleHistoryPanel}
        />
        <Routes>
          <Route path={ROUTES.Root} element={<ConversationRoute />} />
          <Route
            path={ROUTES.Catalog}
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
      {isConversationRoute && <ConversationSourcesPanel />}
    </div>
  );
};

export default memo(App);
