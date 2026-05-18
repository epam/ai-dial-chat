import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ConversationRoute from '../pages/ConversationRoute/ConversationRoute';
import Header from '../components/Header/Header';
import Navigation from '../components/Navigation/Navigation';
import RouteFallback from '../components/RouteFallback/RouteFallback';
import { ROUTES } from '../constants/routes';

const CatalogView = lazy(() => import('../components/CatalogView/CatalogView'));

const ConversationPage = lazy(() =>
  import('../components/ConversationPage/ConversationPage').then((m) => ({
    default: m.ConversationPage,
  })),
);

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
            path="/conversations/:conversationId"
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
