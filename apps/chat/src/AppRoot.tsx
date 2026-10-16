import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import { lazy, memo, Suspense, type FC } from 'react';
import { Route, Routes } from 'react-router';
import App from './app/app';
import NotificationContainer from './components/Notification/NotificationContainer';
import RequireAuth from './components/RequireAuth/RequireAuth';
import AppConfigProvider from './context/AppConfigContext';
import { UserProvider } from './context/auth/UserContext';
import { CelebrationHost } from './context/CelebrationHost';
import { ClientChannelProvider } from './context/ClientChannelContext';
import { ConversationPanelProvider } from './context/ConversationPanelContext';
import { ConversationsProvider } from './context/ConversationsContext';
import { DeploymentsProvider } from './context/DeploymentsContext';
import { FavoriteApplicationsProvider } from './context/FavoriteApplicationsContext';
import { GenerationProvider } from './context/GenerationContext';
import { IsolatedModelViewProvider } from './context/IsolatedModelViewContext';
import { NotificationProvider } from './context/NotificationContext';
import { OverlayModeGate } from './context/overlay/OverlayContext';
import { PromptsProvider } from './context/PromptsContext';
import { SkillsProvider } from './context/SkillsContext';
import { SourcesSidebarProvider } from './context/SourcesSidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiFeaturesProvider } from './context/UiFeaturesContext';
import { UnsavedChangesProvider } from './context/UnsavedChangesContext';
import { UserConfigProvider } from './context/UserConfigContext';
import { VisualizerMessageProvider } from './context/VisualizerMessageContext';

const LoginPage = lazy(() => import('./pages/auth/Login'));
const OverlayClose = lazy(() => import('./pages/auth/OverlayClose'));

/*
 * The provider stack and top-level `<Routes>`, rendered as the element of the
 * single splat route of the data router created in `main.tsx`. Living in its
 * own module keeps it renderable under `createMemoryRouter` in tests without
 * the `main.tsx` side effects (root mount, chunk-load recovery, global CSS).
 */
const AppRoot: FC = () => (
  <NotificationProvider>
    <NotificationContainer />
    <UserProvider>
      <ThemeProvider>
        <AppConfigProvider>
          <UiFeaturesProvider>
            <CelebrationHost>
              <SourcesSidebarProvider>
                <AttachmentCanvasProvider>
                  <ConversationPanelProvider>
                    <Suspense fallback={null}>
                      <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                          path="/overlay-close"
                          element={<OverlayClose />}
                        />
                        <Route
                          path="*"
                          element={
                            <OverlayModeGate>
                              <RequireAuth>
                                <GenerationProvider>
                                  <ClientChannelProvider>
                                    <UserConfigProvider>
                                      <DeploymentsProvider>
                                        {/* TODO: remove in next release */}
                                        <IsolatedModelViewProvider>
                                          <FavoriteApplicationsProvider>
                                            <PromptsProvider>
                                              <SkillsProvider>
                                                <ConversationsProvider>
                                                  <VisualizerMessageProvider>
                                                    <UnsavedChangesProvider>
                                                      <App />
                                                    </UnsavedChangesProvider>
                                                  </VisualizerMessageProvider>
                                                </ConversationsProvider>
                                              </SkillsProvider>
                                            </PromptsProvider>
                                          </FavoriteApplicationsProvider>
                                        </IsolatedModelViewProvider>
                                      </DeploymentsProvider>
                                    </UserConfigProvider>
                                  </ClientChannelProvider>
                                </GenerationProvider>
                              </RequireAuth>
                            </OverlayModeGate>
                          }
                        />
                      </Routes>
                    </Suspense>
                  </ConversationPanelProvider>
                </AttachmentCanvasProvider>
              </SourcesSidebarProvider>
            </CelebrationHost>
          </UiFeaturesProvider>
        </AppConfigProvider>
      </ThemeProvider>
    </UserProvider>
  </NotificationProvider>
);

export default memo(AppRoot);
