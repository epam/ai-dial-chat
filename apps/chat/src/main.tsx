import { AttachmentCanvasProvider } from '@epam/ai-dial-attachment-canvas';
import '@epam/ai-dial-ui-kit/styles.css';
import '@epam/ai-dial-react-pdf-highlighter/styles.css';
import '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './app/app';
import { RootErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import NotificationContainer from './components/Notification/NotificationContainer';
import RequireAuth from './components/RequireAuth/RequireAuth';
import AppConfigProvider from './context/AppConfigContext';
import { UserProvider } from './context/auth/UserContext';
import { ConversationsProvider } from './context/ConversationsContext';
import { DeploymentsProvider } from './context/DeploymentsContext';
import { NotificationProvider } from './context/NotificationContext';
import { SourcesSidebarProvider } from './context/SourcesSidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserConfigProvider } from './context/UserConfigContext';
import './i18n/config';
import './styles.scss';

const LoginPage = lazy(() => import('./pages/auth/Login'));

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
                <DeploymentsProvider>
                  <SourcesSidebarProvider>
                    <AttachmentCanvasProvider>
                      <Suspense fallback={null}>
                        <Routes>
                          <Route path="/login" element={<LoginPage />} />
                          <Route
                            path="*"
                            element={
                              <RequireAuth>
                                <UserConfigProvider>
                                  <ConversationsProvider>
                                    <App />
                                  </ConversationsProvider>
                                </UserConfigProvider>
                              </RequireAuth>
                            }
                          />
                        </Routes>
                      </Suspense>
                    </AttachmentCanvasProvider>
                  </SourcesSidebarProvider>
                </DeploymentsProvider>
              </AppConfigProvider>
            </ThemeProvider>
          </UserProvider>
        </NotificationProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </StrictMode>,
);
