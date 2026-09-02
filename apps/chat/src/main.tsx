import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-file-manager/styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import App from './app/app';
import { RootErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import NotificationContainer from './components/Notification/NotificationContainer';
import RequireAuth from './components/RequireAuth/RequireAuth';
import AppConfigProvider from './context/AppConfigContext';
import { UserProvider } from './context/auth/UserContext';
import { ClientChannelProvider } from './context/ClientChannelContext';
import { ConversationPanelProvider } from './context/ConversationPanelContext';
import { ConversationsProvider } from './context/ConversationsContext';
import { DeploymentsProvider } from './context/DeploymentsContext';
import { FavoriteApplicationsProvider } from './context/FavoriteApplicationsContext';
import { GenerationProvider } from './context/GenerationContext';
import { NotificationProvider } from './context/NotificationContext';
import { OverlayModeGate } from './context/overlay/OverlayContext';
import { PromptsProvider } from './context/PromptsContext';
import { SkillsProvider } from './context/SkillsContext';
import { SourcesSidebarProvider } from './context/SourcesSidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { UiFeaturesProvider } from './context/UiFeaturesContext';
import { UserConfigProvider } from './context/UserConfigContext';
import './i18n/config';
import './styles.scss';

const LoginPage = lazy(() => import('./pages/auth/Login'));
const OverlayClose = lazy(() => import('./pages/auth/OverlayClose'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <NotificationProvider>
          <NotificationContainer />
          <UserProvider>
            <ThemeProvider>
              <AppConfigProvider>
                <UiFeaturesProvider>
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
                                            <FavoriteApplicationsProvider>
                                              <PromptsProvider>
                                                <SkillsProvider>
                                                  <ConversationsProvider>
                                                    <App />
                                                  </ConversationsProvider>
                                                </SkillsProvider>
                                              </PromptsProvider>
                                            </FavoriteApplicationsProvider>
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
                </UiFeaturesProvider>
              </AppConfigProvider>
            </ThemeProvider>
          </UserProvider>
        </NotificationProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
