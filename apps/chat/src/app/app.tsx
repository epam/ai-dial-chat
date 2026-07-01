import {
  AttachmentCanvasContainer,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { CodeBlockTheme } from '@epam/ai-dial-chat-shared';
import { FilterTab } from '@epam/ai-dial-conversation-panel';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';
import ChatLayout from '../components/ChatLayout/ChatLayout';
import ConversationPanelView from '../components/ConversationPanel/ConversationPanelView';
import ConversationSourcesPanel from '../components/ConversationSourcesPanel/ConversationSourcesPanel';
import { RouteErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import {
  getConversationRoute,
  normalizeConversationId,
} from '../constants/routes';
import {
  AttachmentCanvasI18nKeys,
  ButtonsI18nKeys,
} from '../constants/translation-keys';
import { useTheme } from '../context/ThemeContext';
import { useIsMobile } from '../hooks/breakpoint/useBreakpoint';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';
import { ROUTES } from '../types/routes';
import { ThemeId } from '../types/theme-id';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));
const AppsEditorPage = lazy(() => import('../pages/AppsEditor/AppsEditor'));

// Start loading the module immediately so the Suspense fallback is skipped on first navigation.
const conversationPageModule = import('../pages/Conversation/Conversation');

const ConversationPage = lazy(async () => {
  const module = await conversationPageModule;
  return { default: module.ConversationPage };
});

const App: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const canvasDefaultWidth = isMobile
    ? undefined
    : Math.min(1500, Math.round(window.innerWidth * (2 / 3)));
  const { currentTheme } = useTheme();
  const codeBlockTheme =
    currentTheme === ThemeId.Light ? CodeBlockTheme.Light : CodeBlockTheme.Dark;

  const [isNavOpen, setIsNavOpen] = useState(false);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const toggleNav = useCallback(() => setIsNavOpen((prev) => !prev), []);

  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(true);
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

  const { closeCanvas, isOpen: isCanvasOpen } = useAttachmentCanvas();
  useEffect(() => {
    closeCanvas();
    if (
      pathname !== ROUTES.Root &&
      pathname !== ROUTES.Conversations &&
      !pathname.startsWith(ROUTES.Conversations)
    ) {
      closeHistoryPanel();
    } else if (!isMobile && !isCanvasOpen) {
      setIsHistoryPanelOpen(true);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isCanvasOpen) closeHistoryPanel();
  }, [isCanvasOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const switchToMyChatsOnNavRef = useRef(false);
  const [panelRequestedFilter, setPanelRequestedFilter] = useState<
    FilterTab | undefined
  >(undefined);
  const activeFilterRef = useRef<FilterTab>(FilterTab.All);

  const handlePanelActiveFilterChange = useCallback((tab: FilterTab) => {
    activeFilterRef.current = tab;
  }, []);

  useEffect(() => {
    if (!switchToMyChatsOnNavRef.current) return;
    switchToMyChatsOnNavRef.current = false;
    setPanelRequestedFilter(FilterTab.MyChats);
  }, [activeConversationId]);

  const handleDuplicateReadonly = useCallback(() => {
    const filter = activeFilterRef.current;
    if (filter === FilterTab.Organization || filter === FilterTab.Shared) {
      switchToMyChatsOnNavRef.current = true;
    }
  }, []);

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
        requestedFilter={panelRequestedFilter}
        onRequestedFilterChange={() => setPanelRequestedFilter(undefined)}
        onActiveFilterChange={handlePanelActiveFilterChange}
        onDuplicateReadonly={handleDuplicateReadonly}
      />

      <main
        id="main-content"
        role="main"
        className="main-inset-shadow flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <Header
          onMenuToggle={toggleNav}
          isConversationPanelOpen={isHistoryPanelOpen}
          onConversationPanelToggle={toggleHistoryPanel}
          onNewChat={() => navigate(ROUTES.Root)}
        />
        <Routes>
          <Route
            element={
              <ChatLayout
                isHistoryPanelOpen={isHistoryPanelOpen}
                onToggleHistoryPanel={toggleHistoryPanel}
                onNewChat={() => navigate(ROUTES.Root)}
              />
            }
          >
            <Route path={ROUTES.Root} element={<ConversationRoute />} />
            <Route
              path="/conversations/*"
              element={
                <RouteErrorBoundary>
                  <Suspense fallback={<RouteFallback />}>
                    <ConversationPage
                      onDuplicateReadonly={handleDuplicateReadonly}
                    />
                  </Suspense>
                </RouteErrorBoundary>
              }
            />
          </Route>
          <Route
            path={ROUTES.Catalog}
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                  <CatalogView />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
          <Route
            path={ROUTES.AppsEditor}
            element={
              <RouteErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                  <AppsEditorPage />
                </Suspense>
              </RouteErrorBoundary>
            }
          />
        </Routes>
      </main>
      {isConversationRoute && <ConversationSourcesPanel />}
      {isConversationRoute && (
        <AttachmentCanvasContainer
          ariaLabel={t(AttachmentCanvasI18nKeys.AriaLabel)}
          closeLabel={t(AttachmentCanvasI18nKeys.CloseLabel)}
          downloadLabel={t(AttachmentCanvasI18nKeys.DownloadLabel)}
          unsupportedLabel={t(AttachmentCanvasI18nKeys.UnsupportedLabel)}
          copyMarkdownLabel={t(ButtonsI18nKeys.CopyAsMarkdown)}
          copiedMarkdownLabel={t(ButtonsI18nKeys.Copied)}
          copyJsonLabel={t(ButtonsI18nKeys.CopyAsJson)}
          copiedJsonLabel={t(ButtonsI18nKeys.Copied)}
          isMobile={isMobile}
          defaultWidth={canvasDefaultWidth}
          codeBlockTheme={codeBlockTheme}
        />
      )}
    </div>
  );
};

export default memo(App);
