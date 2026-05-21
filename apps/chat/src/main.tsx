import '@epam/ai-dial-ui-kit/styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './app/app';
import RequireAuth from './components/RequireAuth/RequireAuth';
import { UserProvider } from './context/auth/UserContext';
import { ModelsProvider } from './context/ModelsContext';
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
          <ModelsProvider>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="*"
                  element={
                    <RequireAuth>
                      <App />
                    </RequireAuth>
                  }
                />
              </Routes>
            </Suspense>
          </ModelsProvider>
        </ThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
