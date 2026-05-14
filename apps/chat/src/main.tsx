import '@epam/ai-dial-ui-kit/styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './app/app';
import RequireAuth from './components/Common/RequireAuth';
import './i18n/config';
import './styles.scss';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';

const LoginPage = lazy(() => import('./pages/Login'));

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <ThemeProvider>
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
        </ThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
