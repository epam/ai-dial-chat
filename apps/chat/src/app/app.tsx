import {
  AttachmentCanvasContainer,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { clearAttachmentCache } from '@epam/ai-dial-chat-hooks/file-manager-canvas';
import {
  usePanelMaxWidth,
  useViewportWidth,
} from '@epam/ai-dial-chat-hooks/viewport-layout';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  CodeBlockTheme,
  FilterTab,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
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
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router';
import AnnouncementBanner from '../components/AnnouncementBanner/AnnouncementBanner';
import ChatLayout from '../components/ChatLayout/ChatLayout';
import ConversationPanelView from '../components/ConversationPanel/ConversationPanelView';
import ConversationSourcesPanel from '../components/ConversationSourcesPanel/ConversationSourcesPanel';
import { RouteErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import Header from '../components/Header/Header';
import SourcesSidebarToggle from '../components/Header/SourcesSidebarToggle';
import SidebarNavigation from '../components/Navigation/SidebarNavigation';
import NewVersionFallback from '../components/NewVersionFallback/NewVersionFallback';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { MIN_CONTENT_AREA_WIDTH } from '../constants/layout';
import {
  getConversationRoute,
  isConversationPagePath,
  normalizeConversationId,
} from '../constants/routes';
import {
  AttachmentCanvasI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  SidebarI18nKeys,
  AttachmentsI18nKeys,
} from '../constants/translation-keys';
import { ActiveScheduledTaskProvider } from '../context/ActiveScheduledTaskContext';
import { useSourcesSidebar } from '../context/SourcesSidebarContext';
import { useTheme } from '../context/ThemeContext';
import { useCanvasVisualizerMessageHandler } from '../hooks/attachment/useCanvasVisualizerMessageHandler';
import { usePdfPreviewLoader } from '../hooks/attachment/usePdfPreviewLoader';
import { useConversationListBridge } from '../hooks/conversation/useConversationListBridge';
import { useConversationPanelRouteState } from '../hooks/conversation-panel/useConversationPanelRouteState';
import { useOverlayPendingModel } from '../hooks/overlay/useOverlayPendingModel';
import { useAppVersionCheck } from '../hooks/useAppVersionCheck/useAppVersionCheck';
import { useUiFeature } from '../hooks/useUiFeature';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';
import { ApplicationEditorKind } from '../types/application-editor';
import { ROUTES } from '../types/routes';
import { ThemeId } from '../types/theme-id';
import {
  getNavigationSidebarWidth,
  resolveCanvasWidth,
} from '../utils/canvas-width';
import { configurePdfWorker } from '../utils/pdf';
import { renderSettingsRoutes, renderUsageRoute } from './settings-routes';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));
const DialFileManagerPage = lazy(
  () => import('../pages/DialFileManagerPage/DialFileManagerPage'),
);
const ProjectsPage = lazy(() => import('../pages/ProjectsPage/ProjectsPage'));
const ProjectCreatePage = lazy(
  () => import('../pages/ProjectCreatePage/ProjectCreatePage'),
);
const ProjectChatPage = lazy(
  () => import('../pages/ProjectChatPage/ProjectChatPage'),
);
const ProjectViewPage = lazy(
  () => import('../pages/ProjectViewPage/ProjectViewPage'),
);
const ProjectEditPage = lazy(
  () => import('../pages/ProjectEditPage/ProjectEditPage'),
);
const ProjectSharedInvitationPage = lazy(
  () => import('../pages/ProjectSharedInvitation/ProjectSharedInvitation'),
);
const ScheduledTasksPage = lazy(
  () => import('../pages/ScheduledTasksPage/ScheduledTasksPage'),
);
const ScheduledTaskCreatePage = lazy(
  () => import('../pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage'),
);
const ScheduledTaskDetailPage = lazy(
  () => import('../pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage'),
);
const ScheduledTaskEditPage = lazy(
  () => import('../pages/ScheduledTaskEditPage/ScheduledTaskEditPage'),
);
const ApplicationEditorPage = lazy(
  () => import('../pages/ApplicationEditor/ApplicationEditorPage'),
);
const PromptEditorPage = lazy(
  () => import('../pages/PromptEditor/PromptEditor'),
);
const SkillEditorPage = lazy(() => import('../pages/SkillEditor/SkillEditor'));
const ToolsetAuthCallbackPage = lazy(
  () => import('../pages/ToolsetAuthCallback/ToolsetAuthCallback'),
);
const SigninInterruptDialog = lazy(
  () => import('../components/SigninInterruptDialog/SigninInterruptDialog'),
);
const SharedInvitationPage = lazy(
  () => import('../pages/SharedInvitation/SharedInvitation'),
);
const ConversationSharedInvitationPage = lazy(
  () =>
    import('../pages/ConversationSharedInvitation/ConversationSharedInvitation'),
);
const NotFoundPage = lazy(() => import('../pages/NotFound/NotFound'));

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
  const loadPdf = usePdfPreviewLoader();
  const isFileManagerRoute = !!useMatch(ROUTES.FileManager);
  const viewportWidth = useViewportWidth();
  const { currentTheme } = useTheme();
  const codeBlockTheme =
    currentTheme === ThemeId.Light ? CodeBlockTheme.Light : CodeBlockTheme.Dark;
  const { isNewVersionAvailable } = useAppVersionCheck();
  // TODO: remove in next release

  /*
   * Registers the overlay's conversation-list bridge. Mounted here (below
   * ConversationsProvider/DeploymentsProvider) so both are reachable; no-op
   * outside overlay mode.
   */
  useConversationListBridge();

  /* Applies an overlay host's modelId once deployments are loaded. */
  useOverlayPendingModel();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const closeNav = useCallback(() => setIsNavOpen(false), []);
  const toggleNav = useCallback(() => setIsNavOpen((prev) => !prev), []);

  const isConversationsSectionOpenByDefault = useUiFeature(
    OverlayFeature.ShowConversationsSectionByDefault,
  );
  const isAttachmentsManagerEnabled = useUiFeature(
    OverlayFeature.AttachmentsManager,
  );
  const isFileManagerEnabled = useUiFeature(OverlayFeature.FileManager);
  const isSettingsPageHidden = useUiFeature(OverlayFeature.HideSettingsPage);
  const isUsagePageHidden = useUiFeature(OverlayFeature.HideUsagePage);

  const { closeCanvas, isOpen: isCanvasOpen } = useAttachmentCanvas();
  const handleCanvasVisualizerSendMessage = useCanvasVisualizerMessageHandler();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();

  const { isPanelOpen, togglePanel } = useConversationPanelRouteState({
    pathname,
    isMobile,
    isCanvasOpen,
    isOpenByDefault: isConversationsSectionOpenByDefault,
    onCloseCanvas: closeCanvas,
    onCloseSourcesPanel: closeSourcesPanel,
  });

  /* The canvas opens beside the sidebar in whatever state the user left it, so
     its width is bounded by the room the sidebar leaves; on mobile the sidebar
     is a drawer and takes none. */
  const navigationSidebarWidth = isMobile
    ? 0
    : getNavigationSidebarWidth(isPanelOpen);
  const canvasMaxWidth = usePanelMaxWidth(
    MIN_CONTENT_AREA_WIDTH + navigationSidebarWidth,
  );
  const { defaultWidth: canvasDefaultWidth, minWidth: canvasMinWidth } =
    resolveCanvasWidth({
      isFileManagerRoute,
      isMobile,
      viewportWidth,
      maxWidth: canvasMaxWidth,
    });

  useEffect(() => {
    clearAttachmentCache();
  }, [pathname]);

  const matchRoot = useMatch(ROUTES.Root);
  /* A top-level or a project chat; the sidebar highlight below stays `/conversations/` only. */
  const isConversationRoute = !!matchRoot || isConversationPagePath(pathname);
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

  /* Stable, so `memo(ConversationPanelView)` holds across App re-renders. */
  const handlePanelRequestedFilterChange = useCallback(
    () => setPanelRequestedFilter(undefined),
    [],
  );

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

  /* The drawer has nothing to close once the viewport leaves the mobile band. */
  useEffect(() => {
    if (!isMobile) closeNav();
  }, [isMobile, closeNav]);

  /* A drawer opened on a mobile viewport closes behind any chat the user picks,
     including the one already open, which changes no route. */
  const handleSelectConversation = useCallback(
    (id: string) => {
      if (isMobile) {
        closeNav();
      }

      const conversationRoute = getConversationRoute(id);
      navigate(conversationRoute);
    },
    [navigate, isMobile, closeNav],
  );

  const handleNewChat = useCallback(() => {
    if (isMobile) {
      closeNav();
    }
    navigate(ROUTES.Root);
  }, [navigate, isMobile, closeNav]);

  if (isNewVersionAvailable) {
    return <NewVersionFallback />;
  }

  /* The chats block of the navigation sidebar. */
  const conversationPanelView = (
    <ConversationPanelView
      activeConversationId={activeConversationId}
      onSelectConversation={handleSelectConversation}
      requestedFilter={panelRequestedFilter}
      onRequestedFilterChange={handlePanelRequestedFilterChange}
      onActiveFilterChange={handlePanelActiveFilterChange}
      onDuplicateReadonly={handleDuplicateReadonly}
      isVisible={isMobile ? isNavOpen : isPanelOpen}
    />
  );

  return (
    <div className="flex size-full flex-col">
      <AnnouncementBanner />
      <div className="flex min-h-0 flex-1 flex-row">
        <Suspense fallback={null}>
          <SigninInterruptDialog />
        </Suspense>
        <SidebarNavigation
          chats={conversationPanelView}
          isCollapsed={!isPanelOpen}
          onToggleCollapse={togglePanel}
          isOpen={isNavOpen}
          onClose={closeNav}
        />

        <ActiveScheduledTaskProvider>
          {/* The open drawer has no backdrop, so the page behind it is inert:
              Tab and screen readers stay inside the drawer. */}
          <main
            id="main-content"
            role="main"
            inert={isMobile && isNavOpen}
            className="relative flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <Header
              onMenuToggle={toggleNav}
              isMenuOpen={isNavOpen}
              onNewChat={handleNewChat}
            />
            <Routes>
              <Route element={<ChatLayout />}>
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
                <Route
                  path={ROUTES.ProjectChat}
                  element={
                    <RouteErrorBoundary>
                      <Suspense fallback={<RouteFallback />}>
                        <ProjectChatPage />
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
                path={ROUTES.SharedInvitation}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <SharedInvitationPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ConversationSharedInvitation}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ConversationSharedInvitationPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              {renderSettingsRoutes(isSettingsPageHidden)}
              <Route
                path={ROUTES.FileManager}
                element={
                  isFileManagerEnabled ? (
                    <RouteErrorBoundary>
                      <Suspense fallback={<RouteFallback />}>
                        <DialFileManagerPage />
                      </Suspense>
                    </RouteErrorBoundary>
                  ) : (
                    /* Keeps a direct /files URL from bypassing the hidden nav entry. */
                    <Navigate to={ROUTES.Root} replace />
                  )
                }
              />
              {renderUsageRoute(isUsagePageHidden)}
              <Route
                path={ROUTES.Projects}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ProjectsPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ProjectCreate}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ProjectCreatePage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ProjectView}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ProjectViewPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ProjectEdit}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ProjectEditPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ProjectSharedInvitation}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ProjectSharedInvitationPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ScheduledTasks}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ScheduledTasksPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ScheduledTaskCreate}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ScheduledTaskCreatePage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ScheduledTaskDetail}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ScheduledTaskDetailPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ScheduledTaskEdit}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ScheduledTaskEditPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.AppsEditor}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ApplicationEditorPage
                        kind={ApplicationEditorKind.QuickApp}
                      />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ToolsetEditorCallback}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ToolsetAuthCallbackPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ToolsetSignIn}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ToolsetAuthCallbackPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.ToolsetEditor}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ApplicationEditorPage
                        kind={ApplicationEditorKind.Toolset}
                      />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.CustomAppEditor}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <ApplicationEditorPage
                        kind={ApplicationEditorKind.CustomApp}
                      />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.PromptEditor}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <PromptEditorPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path={ROUTES.SkillEditor}
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <SkillEditorPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="*"
                element={
                  <RouteErrorBoundary>
                    <Suspense fallback={<RouteFallback />}>
                      <NotFoundPage />
                    </Suspense>
                  </RouteErrorBoundary>
                }
              />
            </Routes>
          </main>
          {isConversationRoute && <ConversationSourcesPanel />}
        </ActiveScheduledTaskProvider>
        {(isFileManagerRoute ||
          (isConversationRoute && isAttachmentsManagerEnabled)) && (
          <AttachmentCanvasContainer
            loadPdf={loadPdf}
            onVisualizerSendMessage={handleCanvasVisualizerSendMessage}
            labels={{
              ariaLabel: t(AttachmentCanvasI18nKeys.AriaLabel),
              closeLabel: t(AttachmentCanvasI18nKeys.CloseLabel),
              resizeLabel: t(SidebarI18nKeys.ResizePanel),
              visualizerErrorLabel: t(
                AttachmentCanvasI18nKeys.VisualizerLoadErrorLabel,
              ),
              downloadLabel: t(AttachmentCanvasI18nKeys.DownloadLabel),
              unsupportedLabel: t(AttachmentCanvasI18nKeys.UnsupportedLabel),
              loadErrorLabel: t(AttachmentCanvasI18nKeys.LoadErrorLabel),
              forbiddenErrorLabel: t(
                AttachmentCanvasI18nKeys.ForbiddenErrorLabel,
              ),
              copyTextLabel: t(ButtonsI18nKeys.CopyText),
              copiedTextLabel: t(ButtonsI18nKeys.Copied),
              copyMarkdownLabel: t(ButtonsI18nKeys.CopyAsMarkdown),
              copiedMarkdownLabel: t(ButtonsI18nKeys.Copied),
              copyJsonLabel: t(ButtonsI18nKeys.CopyAsJson),
              copiedJsonLabel: t(ButtonsI18nKeys.Copied),
              htmlFrameBlockedLabel: t(
                AttachmentCanvasI18nKeys.HtmlFrameBlocked,
              ),
              htmlOpenInNewTabLabel: t(AttachmentsI18nKeys.OpenInNewTab),
              htmlViewSourceLabel: t(AttachmentCanvasI18nKeys.HtmlViewSource),
              htmlViewRenderedLabel: t(
                AttachmentCanvasI18nKeys.HtmlViewRendered,
              ),
              pdfThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfThumbnailsLabel,
              ),
              pdfShowThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfShowThumbnailsLabel,
              ),
              pdfHideThumbnailsLabel: t(
                AttachmentCanvasI18nKeys.PdfHideThumbnailsLabel,
              ),
              pdfPageNumberLabel: t(
                AttachmentCanvasI18nKeys.PdfPageNumberLabel,
              ),
              mcpAppReloadLabel: t(ButtonsI18nKeys.Reload),
              pdfContentLoadingLabel: t(
                AttachmentCanvasI18nKeys.PdfContentLoadingLabel,
              ),
              pdfContentErrorLabel: t(
                AttachmentCanvasI18nKeys.PdfContentErrorLabel,
              ),
              pdfContentRetryLabel: t(ButtonsI18nKeys.Retry),
              xlsxFormulaLabel: t(AttachmentCanvasI18nKeys.XlsxFormulaLabel),
              codeContentLoadingLabel: t(
                AttachmentCanvasI18nKeys.CodeContentLoadingLabel,
              ),
              codeContentErrorLabel: t(
                AttachmentCanvasI18nKeys.CodeContentErrorLabel,
              ),
              codeContentRetryLabel: t(ButtonsI18nKeys.Retry),
              tableCopyLabel: t(ButtonsI18nKeys.Copy),
              tableCopiedLabel: t(ButtonsI18nKeys.Copied),
              tableDownloadCsvLabel: t(ButtonsI18nKeys.DownloadAsCsv),
              codeBlockCopyLabel: t(ButtonsI18nKeys.Copy),
              codeBlockCopiedLabel: t(ButtonsI18nKeys.Copied),
              codeBlockDownloadLabel: t(ButtonsI18nKeys.Download),
              tableScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableTable),
              mathScrollRegionAriaLabel: t(ChatI18nKeys.ScrollableFormula),
              ooxmlHighlightsLabel: t(
                AttachmentCanvasI18nKeys.OoxmlHighlightsLabel,
              ),
              ooxmlHighlightNavigatedLabel: t(
                AttachmentCanvasI18nKeys.OoxmlHighlightNavigatedLabel,
              ),
            }}
            leftActions={isMobile ? <SourcesSidebarToggle /> : undefined}
            isMobile={isMobile}
            defaultWidth={canvasDefaultWidth}
            minWidth={canvasMinWidth}
            maxWidth={canvasMaxWidth}
            codeBlockTheme={codeBlockTheme}
            configurePdfWorker={configurePdfWorker}
          />
        )}
      </div>
    </div>
  );
};

export default memo(App);
