import { SessionContextValue, signIn, useSession } from 'next-auth/react';
import React, { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { useRouteHistory } from '@/src/hooks/useRouteHistory';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getPageType } from '@/src/utils/app/route';
import { signInInOverlay } from '@/src/utils/auth/auth-overlay';

import { Translation } from '@/src/types/translation';

import { AuthActions, SettingsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  MarketplaceSelectors,
  SettingsSelectors,
} from '@/src/store/selectors';
import { SettingsState } from '@/src/store/settings/settings.types';

import { NavigationWrapper } from '@/src/components/Navigation/NavigationWrapper';

import { Loader } from './Common/Loader';
import { Title } from './Title';

const removeQueryString = (url: string) => url.split('?')[0];

export function Layout({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: SettingsState;
}) {
  const router = useRouter();
  const session: SessionContextValue<boolean> = useSession();

  const { t } = useTranslation(Translation.Chat);

  const { previousRoute } = useRouteHistory();

  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const shouldLogin = useAppSelector(AuthSelectors.selectIsShouldLogin);
  const authStatus = useAppSelector(AuthSelectors.selectStatus);
  const isSignInInSameWindow = useAppSelector(
    SettingsSelectors.selectIsSignInInSameWindow,
  );
  const isApplyingModel = useAppSelector(
    MarketplaceSelectors.selectIsApplyingModel,
  );

  const [loading, setLoading] = useState(isApplyingModel);

  const shouldOverlayLogin = isOverlay && shouldLogin;

  const handleStartRedirecting = useCallback((url: string) => {
    setLoading(removeQueryString(url) !== window.location.pathname);
  }, []);
  const handleStopRedirecting = useCallback(() => setLoading(false), []);

  // EFFECTS  --------------------------------------------
  useEffect(() => {
    if (previousRoute) {
      dispatch(UIActions.setPreviousRoute(previousRoute));
    }
  }, [dispatch, previousRoute]);
  useEffect(() => {
    setLoading(isApplyingModel);
  }, [isApplyingModel]);
  useEffect(() => {
    router.events.on('routeChangeStart', handleStartRedirecting);
    router.events.on('routeChangeComplete', handleStopRedirecting);
    router.events.on('routeChangeError', handleStopRedirecting);
    return () => {
      router.events.off('routeChangeStart', handleStartRedirecting);
      router.events.off('routeChangeComplete', handleStopRedirecting);
      router.events.off('routeChangeError', handleStopRedirecting);
    };
  }, [handleStartRedirecting, handleStopRedirecting, router.events]);
  useEffect(() => {
    if (!isOverlay && shouldLogin) {
      signIn();
    }
  }, [isOverlay, shouldLogin]);

  useEffect(() => {
    dispatch(AuthActions.setSession(session));
  }, [dispatch, session]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
      dispatch(UIActions.resize());
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    dispatch(SettingsActions.initApp(getPageType(router.route)));
  }, [dispatch, settings, router.route]);

  const handleOverlayAuth = async () => {
    signInInOverlay(`/api/auth/signin`, isSignInInSameWindow);
  };

  return (
    <>
      <Title settings={settings} />
      {shouldOverlayLogin ? (
        <div className="grid size-full min-h-[100px] place-items-center bg-layer-1 text-sm text-primary">
          <button
            onClick={handleOverlayAuth}
            className="button button-secondary"
            disabled={authStatus === 'loading'}
          >
            {t('Login')}
          </button>
        </div>
      ) : (
        <main
          // eslint-disable-next-line tailwindcss/enforces-shorthand
          className="h-screen w-screen flex-col bg-layer-1 text-sm text-primary"
          id="theme-main"
        >
          <NavigationWrapper>{children}</NavigationWrapper>
        </main>
      )}
      {loading && (
        <Loader containerClassName="absolute bg-blackout size-full top-0 z-50" />
      )}
    </>
  );
}
