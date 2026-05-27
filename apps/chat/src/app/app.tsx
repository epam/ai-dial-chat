import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { ROUTES } from '../constants/routes';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

const ConversationPage = lazy(async () => {
  const module = await import('../pages/Conversation/Conversation');
  return { default: module.ConversationPage };
});

function App() {
  return (
    <div className="flex size-full flex-row">
      <Navigation />
      <main
        id="main-content"
        role="main"
        className="flex min-h-0 flex-1 flex-col bg-layer-1"
      >
        <Header />
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
    </div>
  );
}

export default App;
