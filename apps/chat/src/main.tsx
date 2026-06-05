import '@epam/ai-dial-ui-kit/styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './app/app';
import RequireAuth from './components/RequireAuth/RequireAuth';
import { UserProvider } from './context/auth/UserContext';
import { ConversationsProvider } from './context/ConversationsContext';
import { DeploymentsProvider } from './context/DeploymentsContext';
import { SourcesSidebarProvider } from './context/SourcesSidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import './i18n/config';
import './styles.scss';

const LoginPage = lazy(() => import('./pages/auth/Login'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <ThemeProvider>
          <DeploymentsProvider>
            <SourcesSidebarProvider>
              <Suspense fallback={null}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="*"
                    element={
                      <RequireAuth>
                        <ConversationsProvider>
                          <App />
                        </ConversationsProvider>
                      </RequireAuth>
                    }
                  />
                </Routes>
              </Suspense>
            </SourcesSidebarProvider>
          </DeploymentsProvider>
        </ThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
